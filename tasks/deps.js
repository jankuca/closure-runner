var async = require('async');
var fs = require('fs');
var mkdirp = require('mkdirp');
var path = require('path');


module.exports = function (runner, args, callback) {
  var closure_library_dirname = runner.getConfigValue('closure-library');
  var temp_deps_path = runner.getAppConfigValue('output.deps');
  var roots = runner.getAppConfigValue('roots');

  var scopify = (runner.getAppConfigValue('scopify') === true);

  async.waterfall([
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
    }
  ], callback);
};
