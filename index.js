var request = require('hyperquest');
var through = require('through');
var byline = require('byline');
var vercmp = require('vercmp');
var clc = require('cli-color');
var async = require('async');

var ROOTURL = 'http://cdimage.blankonlinux.or.id/blankon/livedvd-harian/';

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
    for (var content in list)
      contents.push(content);
    async.mapSeries(contents, status, function(err, statuses) {
      for (var i = 0; i < statuses.length; i++) {
        var stat = statuses[i];
        list[contents[i]].status = stat;
      }
      cb(null, list);
    });
  });
}

function status(date, cb) {
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
    for (var row in list)
      console.log(i++ + '. ' + list[row].date + ' - ' + (list[row].status ? clc.green(row) : clc.red(row)));
  });
}

function diff(args) {
  difference(args[0], args[1], function(err, results){
    if (err)
      return console.log(err);
    console.log(args[0] + ' is ... than ' + args[1]);
    for (var type in results) {
      console.log(type + ' (' +  results[type].length + '):');
      for (var i = 0; i < results[type].length; i++) {
        var package = results[type][i];
        console.log('  ' + i + '. ' + package.name + ' ' + clc.green(package.from ? package.from : '') + ' ~> ' + clc.blue(package.to ? package.to : package.version));
      }
    }
  });
}

module.exports = {
  diff: diff,
  ls: ls
};

