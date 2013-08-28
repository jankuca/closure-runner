var async = require('async');
var fs = require('fs');
var mkdirp = require('mkdirp');
var path = require('path');


module.exports = function (runner, args, callback) {
  var closure_library_dirname = runner.getConfigValue('closure-library');
  var closure_template_dirname = runner.getConfigValue('closure-templates');
  var output_path = runner.getAppConfigValue('output');
  var source_map_path = runner.getAppConfigValue('output.source-map');
  var roots = runner.getAppConfigValue('roots');

  var scopify = (runner.getAppConfigValue('scopify') === true);

  var compile;
  var sources;

  async.waterfall([
    function (callback) {
      if (closure_template_dirname) {
        runner.runTask('soy', callback);
      } else {
        callback(null);
      }
    },

    runner.runTask.bind(runner, 'get-closure-compiler'),

    function (compile_, callback) {
      compile = compile_;

      if (scopify) {
        runner.runTask('scopify', callback);
      } else {
        runner.runTask('sources', callback);
      }
    },

    function (sources_, callback) {
      sources = sources_;
      callback(null);
    },

    runner.runTask.bind(runner, 'deps'),

    function (callback) {
      var app_flags = runner.getAppConfigValue('closure-compiler.flags');
      var flags = Object.create(app_flags);

      flags['compilation_level'] = 'ADVANCED_OPTIMIZATIONS';
      flags['warning_level'] = 'VERBOSE';
      flags['language_in'] = 'ECMASCRIPT5_STRICT';
      flags['jscomp_error'] = [
        'ambiguousFunctionDecl',
        'checkRegExp',
        'es5Strict',
        'externsValidation',
        'globalThis',
        'missingProperties',
        'strictModuleDepCheck',
        'suspiciousCode',
        'undefinedNames'
      ];
      flags['jscomp_warning'] = [
        'accessControls',
        'const',
        'constantProperty',
        'visibility'
      ];
      flags['js_output_file'] = '' + output_path;
      flags['summary_detail_level'] = '3';

      flags['output_wrapper'] = '(function(){%output%}.call(this));';
      if (source_map_path) {
        flags['output_wrapper'] += ' //# sourceMappingURL=' +
          path.relative(path.dirname(output_path), path.dirname(source_map_path)) +
          path.basename(source_map_path);
        flags['create_source_map'] = source_map_path;
        flags['source_map_format'] = 'V3';
      }
      flags['output_wrapper'] = '"' + flags['output_wrapper'] + '"';

      flags['js'] = sources.slice();
      flags['js'].unshift(path.join(closure_library_dirname, '/closure/goog/deps.js'));
      flags['js'].unshift(path.join(closure_library_dirname, '/closure/goog/base.js'));

      var externs = runner.getAppConfigValue('externs');
      flags['externs'] = Object.keys(externs).map(function (extern_id) {
        return externs[extern_id];
      });

      compile(flags, callback);
    },

    function (log, callback) {
      if (log) {
        var report = log.match(
          /\s*(\d+)\serror\(s\),\s(\d+)\swarning\(s\)(?:,\s([\d.]+)%\styped)?\s*$/
        );

        if (!report) {
          return callback(new Error(log));
        }

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
    },

    // source map fix
    // --------------
    // The paths put in the map by the compiler are relative to the project
    //   root directory while for the map to be useful, the paths have to be
    //   relative to the source map itself.
    function (callback) {
      if (source_map_path) {
        runner.runTask('fix-source-map', callback);
      } else {
        callback(null);
      }
    }
  ], callback);
};
