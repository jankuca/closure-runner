var async = require('async');
var fs = require('fs');
var mkdirp = require('mkdirp');
var path = require('path');


module.exports = function (runner, args, callback) {
  async.waterfall([
    function (callback) {
      runner.runTask('sources', callback);
    },

    function (sources, callback) {
      var app_dirname = runner.getProjectDirname();
      var temp_dirname = runner.getTempDirname();
      var closure_dirname = runner.getClosureLibraryDirname();

      async.map(sources, function (source, callback) {
        var closure_relative_path = path.relative(closure_dirname, source);
        if (!/^\.\./.test(closure_relative_path)) {
          return callback(null, source);
        }

        var app_relative_source_path = path.join(app_dirname);
        var source_path = path.join(app_dirname, source);
        var temp_source_path = path.join(temp_dirname, source);

        mkdirp.sync(path.dirname(temp_source_path));

        var read_stream = fs.createReadStream(source, { encoding: 'utf8' });
        var write_stream = fs.createWriteStream(temp_source_path);
        var scoped = false;
        var buffer = '';

        read_stream.on('data', function (chunk) {
          if (scoped) {
            write_stream.write(fixRequires(chunk.toString()));
            return;
          }

          buffer = buffer + chunk;
          var lines = buffer.split('\n');
          for (var i = 0, ii = lines.length; i < ii; ++i) {
            if (/^goog\.provide\(/.test(lines[i])) {
              write_stream.write(lines[i] + '\n');
            } else {
              write_stream.write('goog.scope(function () { ');
              scoped = true;
              write_stream.write(fixRequires(lines.slice(i).join('\n')));
              buffer = '';
              return;
            }
          }

          buffer = fixRequires(lines.slice(i).join('\n'));
        });

        read_stream.on('end', function () {
          setTimeout(function () {
            write_stream.write('\n');
            if (scoped) {
              write_stream.write('});\n');
            }

            var rel_temp_source_path = path.relative(app_dirname, temp_source_path);
            callback(null, rel_temp_source_path);
          }, 0);
        });
      }, callback);
    }
  ], callback);
};


function fixRequires(code) {
  code = code.replace(
    /^var(\s.+?[\s=])goog\.require\(['"](.+?)['"]\)/gm,
    'goog.require("$2"); var$1$2'
  );

  return code;
}
