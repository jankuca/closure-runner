var async = require('async');
var fs = require('fs');
var mkdirp = require('mkdirp');
var path = require('path');


module.exports = function (runner, args, callback) {
  var app_dirname = runner.getProjectDirname();
  var closure_library_dirname = runner.getConfigValue('closure-library');
  var closure_template_dirname = runner.getConfigValue('closure-templates');
  var output_path = runner.getAppConfigValue('output');
  var source_map_path = runner.getAppConfigValue('output.source-map');
  var temp_deps_path = runner.getAppConfigValue('output.deps');
  var roots = runner.getAppConfigValue('roots');

  var temp_dirname = runner.getTempDirname();
  var temp_dirname_rel = path.relative(app_dirname, temp_dirname);

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

    runner.runTask.bind(runner, 'get-closure-depswriter'),

    function (depswriter, callback) {
      var flags = {};

      var temp_roots = roots;
      if (scopify) {
        temp_roots = roots.map(function (root) {
          var temp_root = path.join(temp_dirname_rel, root);
          var temp_root_rel = './' + path.relative(app_dirname, temp_root);
          return temp_root_rel;
        });
      }

      if (!temp_roots.every(function (root) {
        var root_closure_rel = path.relative(closure_library_dirname, root);
        return (root_closure_rel.substr(0, 2) === '..');
      })) {
        temp_roots.push(closure_library_dirname);
      }

      flags['root_with_prefix'] = temp_roots.map(function (root) {
        var root_deps_rel = path.relative(
          './' + path.join(closure_library_dirname, '/closure/goog'),
          root
        );

        if (!fs.existsSync(root)) {
          mkdirp.sync(root);
        }

        return root + ' ' + root_deps_rel;
      });

      if (temp_deps_path) {
        depswriter(flags, callback);
      } else {
        callback(null, '');
      }
    },

    function (depswriter_result, callback) {
      if (temp_deps_path) {
        fs.writeFile(temp_deps_path, depswriter_result, callback);
      } else {
        callback(null);
      }
    },

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
    }
  ], callback);
};
