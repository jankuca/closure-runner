var async = require('async');
var fs = require('fs');
var child_process = require('child_process');
var optimist = require('optimist');
var path = require('path');


module.exports = function (runner, args, callback) {
  var app_dirname = runner.getProjectDirname();
  var closure_dirname = runner.getClosureLibraryDirname();
  var app_namespaces = runner.getAppNamespaces();
  var roots = runner.getRoots();

  if (!closure_dirname) {
    return callback(new Error('Closure Library path not specified'), null);
  }
  if (app_namespaces.length === 0) {
    return callback(new Error('No app namespaces specified'), null);
  }
  if (roots.length === 0) {
    return callback(new Error('No roots specified'), null);
  }

  var dir_diff = path.relative(
    closure_dirname + '/closure/goog',
    app_dirname
  );

  async.waterfall([
    function (callback) {
      var command = closure_dirname;
      command += '/closure/bin/build/depswriter.py';

      var command_args = [];
      roots_with_prefixes = roots.forEach(function (root) {
        command_args.push('--root_with_prefix=' + root + ' ' + root);
      });

      child(command, command_args, function (err, result) {
        if (err) {
          callback(err, null);
        } else if (result.code !== 0) {
          callback(new Error(result.stderr), null);
        } else {
          callback(null, result.stdout);
        }
      });
    },

    function (depswriter_result, callback) {
      var namespaces = {};

      var lines = depswriter_result.split('\n');
      lines.forEach(function (line) {
        if (!/^goog\.addDependency\(/.test(line)) return;

        line = line.replace(/^.*?\(/, '').replace(/\).*?$/, '');
        var values = eval('[' + line + ']');

        values[1].forEach(function (provided_ns) {
          namespaces[provided_ns] = {
            source: values[0],
            deps: values[2]
          };
        });
      });

      callback(null, namespaces);
    },

    function (namespaces, callback) {
      var sources = [];
      var current_tree_levels = [];

      var addNS = function (requirer, ns) {
        var source = null;
        if (namespaces[ns]) {
          source = '.' + namespaces[ns].source.replace(dir_diff, '');
        }

        current_tree_levels.push({
          ns: ns,
          source: source
        });

        var desc = namespaces[ns];
        if (!desc) {
          var tree = generateNSTreeMessage(current_tree_levels);
          throw new Error(
            'Unknown namespace \033[0;31m' + ns + '\033[0m\n' +
            '\n' +
            tree
          );
        }

        var source = desc.source;
        var index = sources.indexOf(source);
        if (index !== -1) {
          sources.splice(index, 1);
        }
        sources.unshift(source);

        var addRequiredNS = addNS.bind(null, ns);
        desc.deps.forEach(addRequiredNS);

        current_tree_levels.pop();
      };

      try {
        var addRequiredNS = addNS.bind(null, '<ROOT>');
        app_namespaces.forEach(addRequiredNS);
        callback(null, sources);
      } catch (err) {
        callback(err, null);
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
    result.code = code || 0;
    callback(null, result);
  });
  proc.on('error', function (err) {
    callback(err, result);
  });
}


function generateNSTreeMessage(tree_levels) {
  var tree = '';

  tree_levels.forEach(function (item, level) {
    for (var i = 0; i < level; ++i) {
      tree += '  ';
    }
    tree += '- ';
    switch (level) {
    case tree_levels.length - 1:
      tree += '\033[5;2;31m';
      break;
    case tree_levels.length - 2:
      tree += '\033[0;31m';
      break;
    }
    tree += item.ns;
    if (item.source) {
      tree += ' \033[2;37m(' + item.source + ')';
    }
    tree += '\033[0m';
    tree += '\n';
  });

  return tree;
}