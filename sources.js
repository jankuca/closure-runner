var async = require('async');
var fs = require('fs');
var child_process = require('child_process');
var optimist = require('optimist');


// Process arguments
var args = optimist
  .demand([
    'closure',
    'namespace',
    'root'
  ])
  .argv;

var closure_dirname = args['closure'];

var entry_ns = args['namespace'];
entry_ns = Array.isArray(entry_ns) ? entry_ns : [ entry_ns ];

var roots = args['root'];
roots = Array.isArray(roots) ? roots : [ roots ];


// Generate depswriter.py command
var deps_command = [
  closure_dirname + '/closure/bin/build/depswriter.py'
];
roots.forEach(function (root) {
  deps_command.push('--root="' + root + '"');
});


// Execute
async.waterfall([
  function loadNamespaceMap(callback) {
    child(deps_command.join('\\\n  '), function (err, result) {
      if (err) return callback(err);

      var namespaces = {};

      var lines = result.stdout.split('\n');
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
    });
  },

  function getSourceList(namespaces, callback) {
    var sources = [];
    var current_tree_levels = [];

    var addNS = function (requirer, required_ns) {
      current_tree_levels.push(required_ns);

      var desc = namespaces[required_ns];
      if (!desc) {
        var tree = '';
        current_tree_levels.forEach(function (ns, level) {
          for (var i = 0; i < level; ++i) {
            tree += '  ';
          }
          tree += '- ';
          switch (level) {
          case current_tree_levels.length - 1:
            tree += '\033[5;2;31m';
            break;
          case current_tree_levels.length - 2:
            tree += '\033[0;31m';
            break;
          default:
            tree += '\033[2;38m';
          }
          tree += ns;
          tree += '\033[0m';
          tree += '\n';
        });

        throw new Error(
          'Unknown namespace \033[0;31m' + required_ns + '\033[0m\n' +
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

      var addRequiredNS = addNS.bind(null, required_ns);
      desc.deps.forEach(addRequiredNS);

      current_tree_levels.pop();
    };

    try {
      var addRequiredNS = addNS.bind(null, '<ROOT>');
      entry_ns.forEach(addRequiredNS);
      callback(null, sources);
    } catch (err) {
      callback(err, null);
    }
  },

  function (err, sources) {

  }
], function (err, sources) {
  if (err) {
    process.stderr.write(err.message);
    process.exit(1);
  }

  process.stdout.write(sources.join('\n'));
});


function child(command, callback) {
  var result = {
    stdout: '',
    stderr: '',
    code: null
  };

  var proc = child_process.exec(deps_command.join('\\\n  '));
  proc.stdout.on('data', function (chunk) {
    result.stdout += chunk;
  });
  proc.stderr.on('data', function (chunk) {
    result.stderr += chunk;
  });
  proc.on('exit', function (code) {
    result.code = code || 0;
    callback(null, result);
  });
  proc.on('error', function (err) {
    callback(err, result);
  })
}
