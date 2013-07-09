var async = require('async');
var child_process = require('child_process');
var fs = require('fs');
var path = require('path');
var shell = require('shelljs');


module.exports = function (runner, args, callback) {
  var app_dirname = runner.getProjectDirname();
  var closure_library_dirname = runner.getClosureLibraryDirname();
  var closure_compiler_dirname = runner.getClosureCompilerDirname();
  var output_path = runner.getOutputPath();
  var source_map_path = runner.getSourceMapPath();

  async.waterfall([
    function (callback) {
      runner.runTask('scopify', callback);
    },

    function (sources, callback) {
      var local_closure_path = path.join(app_dirname, 'node_modules/.bin/closure');
      var local_closure_exists = fs.existsSync(local_closure_path);
      var global_closure = shell.which('closure');

      var command = '';
      var command_args = [];

      if (local_closure_exists) {
        command = local_closure_path;
      } else if (global_closure) {
        command = global_closure;
      } else {
        command = 'java';
        command_args.push('-jar', closure_compiler_dirname + '/compiler.jar');
      }

      command_args.push('--compilation_level=ADVANCED_OPTIMIZATIONS');
      command_args.push('--warning_level=VERBOSE');
      command_args.push('--language_in=ECMASCRIPT5_STRICT');
      command_args.push('--jscomp_error=ambiguousFunctionDecl');
      command_args.push('--jscomp_error=checkRegExp');
      command_args.push('--jscomp_error=es5Strict');
      command_args.push('--jscomp_error=externsValidation');
      command_args.push('--jscomp_error=globalThis');
      command_args.push('--jscomp_error=missingProperties');
      command_args.push('--jscomp_error=strictModuleDepCheck');
      command_args.push('--jscomp_error=suspiciousCode');
      command_args.push('--jscomp_error=undefinedNames');
      command_args.push('--jscomp_warning=accessControls');
      command_args.push('--jscomp_warning=const');
      command_args.push('--jscomp_warning=constantProperty');
      command_args.push('--jscomp_warning=visibility');
      command_args.push('--js_output_file=' + output_path);
      command_args.push('--summary_detail_level=3');

      var output_wrapper = '(function(){%output%}.call(this));';
      if (source_map_path) {
        output_wrapper += ' //# sourceMappingURL=' +
          path.relative(path.dirname(output_path), path.dirname(source_map_path)) +
          path.basename(source_map_path);
        command_args.push('--create_source_map=' + source_map_path);
        command_args.push('--source_map_format=V3');
      }
      command_args.push('--output_wrapper="' + output_wrapper + '"');

      command_args.push('--js=' + path.join(closure_library_dirname, '/closure/goog/base.js'));
      sources.forEach(function (source) {
        command_args.push('--js=' + source);
      });

      child(command, command_args, function (err, result) {
        if (err) {
          callback(err, null);
        } else {
          callback(null, result.stderr);
        }
      })
    },

    function (log, callback) {
      if (log) {
        var report = log.match(
          /\s*(\d+)\serror\(s\),\s(\d+)\swarning\(s\)(?:,\s([\d.]+)%\styped)?\s*$/
        );

        log = log.replace(report[0], '');

        log = log.replace(
          /(^|\n)([\w\/._-]+):(\d+):\s(ERROR|WARNING)\s-\s(.+?)\n([^\n]+)\n(\s*?\^)/g,
          function (match, pre_white, filename, line_no, level, message, code, arrow) {
            var dirname = path.dirname(filename);
            var basename = path.basename(filename);
            return (
              pre_white +
              '\033[2;38m' + dirname + '/\033[0m' + basename +
              '\033[0m\033[2;38m:\033[0;36m' + line_no + '\033[0m\033[2;38m - ' +
              (level === 'ERROR' ? '\033[0;31m' : '\033[0;33m') + message + '\n' +
              '\033[0m' + code + '\n' +
              '\033[0m\033[2;38m' + arrow + '\033[0m'
            );
          }
        );

        if (log) {
          runner.log(log + '\n\n');
        }

        if (args['v']) {
          runner.log(report[0] + '\n');
        }

        if (Number(report[1]) > 0) {
          callback(new Error(
            'Failed to compile JavaScript due to ' +
            '\033[0;31m' + report[1] + ' error\033[2m(s)\033[0m'
          ));
        } else {
          callback(null);
        }
      } else {
        callback(null);
      }
    }
  ], callback);
};


function child(command, args, callback) {
  var result = {
    stdout: '',
    stderr: '',
    code: null
  };

  var proc = child_process.spawn(command, args);

  proc.stdout.on('data', function (chunk) {
    result.stdout += chunk;
  });
  proc.stderr.on('data', function (chunk) {
    result.stderr += chunk;
  });
  proc.on('close', function (code) {
    setTimeout(function () {
      result.code = code || 0;
      callback(null, result);
    }, 0);
  });
  proc.on('error', function (err) {
    callback(err, result);
  });
}
