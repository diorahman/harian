var request = require('hyperquest');
var tar = require('tar-stream');
var extract = tar.extract();
var zlib = require('zlib');
var gunzip = zlib.createGunzip();
var url = 'http://irgsh.blankonlinux.or.id/build/6882/sources/lightdm_1.10.3-3blankon1.debian.tar.gz'
request(url).pipe(gunzip).pipe(extract);
extract.on('entry', function(header, stream, callback){
  stream.on('data', function(data){
      if (header.name == 'debian/changelog') {
        console.log(data.toString());
      }
  });
  stream.on('end', function(){
    callback();
  });
});
