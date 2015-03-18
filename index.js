var JSONStream = require('JSONStream');
var request = require('hyperquest');
var es = require('event-stream');
var through = require('through');
var byline = require('byline');
var vercmp = require('vercmp');
var clc = require('cli-color');
var async = require('async');
var _ = require('lodash');

var ROOTURL = 'http://cdimage.blankonlinux.or.id/blankon/livedvd-harian/';
var DEBIANURL = 'http://ftp.debian.org/debian/dists/sid/main/binary-amd64/Packages.gz';
var RANIURL = 'http://rani.blankon.in:8000/packages';

var Debian = require('./debian');
var Blankon = require('./blankon'); 

function hasBlankon1(version) {
  return version.indexOf('blankon1') >= 0;
}

function stream(sink, end) {
  end = end || function(){};
  var lineStream = byline.createStream();
  lineStream.pipe(through(write, end));
  function write(chunk) {
    sink(chunk);
  }
  return lineStream;
}

function listRoot(cb) {
  var list = {};
  
  var r = request(ROOTURL);
  r.on('error', function(err){
    return cb(err);
  });
  r.pipe(stream(parse, end));

  function parse(line) {
    line = line.toString();
    var contentMatch = line.match('>(.*?)/</a>');
    var dateMatch = line.match('</a>(.*?) -');
    if (contentMatch && dateMatch) {
      var date = dateMatch[1].trim();
      var content = contentMatch[1];
      if (cb) { 
        list[content] = {
          date: date,
          content: content
        }
      }
      else
        console.log(date, content);
    }
  }

  function end() {
    cb(null, list);
  }
}

function listRootWithStatus(cb) {
  cb = cb || function(){};
  listRoot(function(err, list) {
    if (err)
      return cb(err);
    var contents = [];
    for (var key in list) {
      contents.push(list[key]);
    }
    contents.sort(function(a, b) {
      if (a.content == 'current')
        return 1;
      var dateA = new Date(a.date).valueOf();
      var dateB = new Date(b.date).valueOf();
      if (dateA > dateB)
        return 1;
      if (dateA < dateB)
        return -1;
      return 0;
    });
    async.mapSeries(contents, status, function(err, statuses) {
      for (var i = 0; i < statuses.length; i++) {
        var stat = statuses[i];
        list[contents[i].content].status = stat;
      }
      cb(null, contents);
    });
  });
}

function status(row, cb) {
  var date = row.content || row;
  cb = cb || function(){};
  // trailling '/'
  var url = ROOTURL + date + '/';
  var r = request(url);
  r.on('error', function(err){
    return cb(err);
  });
  r.pipe(stream(parse, end));
  var count = 0;

  function parse(line) {
    line = line.toString();
    var contentMatch = line.match('>(.*?)</a>');
    var dateMatch = line.match('</a>(.*?)  ');
    if (contentMatch && dateMatch)
      count++;
  }
  function end() {
    cb(null, count > 2);
  }
}

function difference(a, b, cb) {
  function statusOfA(cb) {
    status(a, cb);
  }
  function statusOfB(cb) {
    status(b, cb);
  }
  async.parallel({
    a : statusOfA,
    b : statusOfB
  }, function(err, result) {
    if (err)
      return cb(err);
    if (!result.a || !result.b)
      return cb(new Error('a and b should be successful builds'));
    // create streams
    var listName = 'tambora-desktop-amd64.list';
    var urlA = ROOTURL + a + '/' + listName;
    var urlB = ROOTURL + b + '/' + listName;
    compare(request(urlA), request(urlB), cb);
  });
}

function compareWithSid(a, cb) {
  //
  process.stdout.write('--> please wait ...\r'); 
  // get data from rani
  var raniRequest = request(RANIURL);
  raniRequest
    .pipe(JSONStream.parse())
    .pipe(es.mapSync(function(repoPackages) {
      var refPackages = {};
      var count = 0;
      var countMatch = 0;
      var result = {
        equal: [],
        greater: [],
        less: []
      };
      // get data from debian sid
      var debian = new Debian();
      debian.resume();
      debian.on('error', cb); 
      debian.on('data', function(debianPackage){
        var found = _.find(repoPackages, function(package){
          return package.name == debianPackage.name;
        });
        
        if (found) {
          countMatch++;
          refPackages[debianPackage.name] = {
            name: debianPackage.name,
            version: debianPackage.version
          }
        }
        process.stdout.write('--> ' + debianPackage.name.substring(0, 4) + '... ' + count++ + '(' + countMatch + ')\r'); 
      });

      debian.on('end', function() {
        status(a, function(err, success) {
          if (err)
            return cb(err);
          if (!success)
            return cb(new Error('`a` should be a successful build'));

          result.blankonUrl = 'http://cdimage.blankonlinux.or.id/blankon/livedvd-harian/' + a + '/tambora-desktop-amd64.list';
          console.log(result.blankonUrl);

          var blankon = new Blankon({url: result.blankonUrl});
          blankon.resume();

          blankon.on('error', cb);

          blankon.on('data', function(blankonPackage){
            if (refPackages[blankonPackage.name]) {
              var version = blankonPackage.version;
              var refVersion = refPackages[blankonPackage.name].version;
              var cmp = vercmp(blankonPackage.version, refVersion);
              var obj = {
                name: blankonPackage.name,
                blankonVersion: blankonPackage.version,
                sidVersion: refVersion,
                hasBlankon1Version: hasBlankon1(version)
              };
              if (cmp == 0)
                result.equal.push(obj);
              if (cmp > 0)
                result.greater.push(obj);
              if (cmp < 0)
                result.less.push(obj);
            }
          });
          blankon.on('end', function() {
            cb(null, result);
          });  
        });
      });
    }));
}

function compare(a, b, cb) {
  var aRequest = a.pipe(stream(accumulate, refEnd));
  a.on('error', function(err){
    return cb(err);
  });
  var ref = {};
  
  // we're interested in less, greater, removed and added packages.
  var results = {
    less: [],
    greater: [],
    removed: [],
    added: []
  };
  var intersects = [];

  function accumulate(line) {
    line = line.toString();
    var arr = line.split(' ');
    var package = {
      name: arr[0],
      version: arr[1]
    };
    ref[package.name] = package;
  }
  
  function cmp(line) {
    line = line.toString();
    var arr = line.split(' ');
    var name = arr[0];
    var version = arr[1];

    var package = {
      name: name,
      version: version
    }

    // FIXME: detect package that: found in a, not in b vice versa.
    if (ref[name]) { // intersections, both list has it
      if (vercmp(version, ref[name].version) > 0) {
        package.from = version;
        package.to = ref[name].version;
        results.less.push(package);
      }
      if (vercmp(version, ref[name].version) < 0) {
        package.from = version;
        package.to = ref[name].version;
        results.greater.push(package);
      }
      intersects.push(package.name);
    } else
      // b has it, a doesn't
      results.removed.push(package);
  }

  function refEnd() {
    var bRequest = b.pipe(stream(cmp, function(){
      for (var packageName in ref) {
        if (intersects.indexOf(packageName) >= 0)
          continue;
        results.added.push(ref[packageName]);
      }
      cb(null, results);
    }));
    b.on('error', function(err){
      return cb(err);
    });
  }
}

function ls() {
  listRootWithStatus(function(err, list){
    if (err)
      return console.log(err);
    var i = 0;
    for (var i = 0; i < list.length; i++) {
      var row = list[i];
      console.log(i + '. ' + row.date + ' - ' + (row.status ? clc.green(row.content) : clc.red(row.content)));
    }
  });
}

function diff(args) {
  difference(args[0], args[1], function(err, results){
    if (err)
      return console.log(err);
    console.log(args[0] + ' vs. ' + args[1]);
    for (var type in results) {
      console.log(type + ' (' +  results[type].length + '):');
      for (var i = 0; i < results[type].length; i++) {
        var package = results[type][i];
        console.log('  ' + i + '. ' + package.name + ' ' + clc.green(package.from ? package.from : '') + ' ~> ' + clc.blue(package.to ? package.to : package.version));
      }
    }
  });
}

function sid(args) {
  compareWithSid(args[0], function(err, res) {
    delete res['blankonUrl'];
    delete res['equal'];
    for (var k in res) {
      console.log(k + ' (' + res[k].length + '):');
      for (var i = 0; i < res[k].length; i++) {
        var package = res[k][i];
        console.log('  ' + i + '. ' + package.name + ' ' + clc.green(package.blankonVersion) + ' ' + clc.blue(package.sidVersion))
      }
    }
  
  });
}

module.exports = {
  diff: diff,
  ls: ls,
  sid: sid
};

