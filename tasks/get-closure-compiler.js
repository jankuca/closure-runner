var fs = require('fs');
var path = require('path');
var shell = require('shelljs');

var child = require('../lib/child');


module.exports = function (runner, args, callback) {
  var be_verbose = args['v'];

  var app_dirname = runner.getProjectDirname();
  var closure_compiler_dirname = runner.getConfigValue('closure-compiler');

  var local_closure_path = path.join(app_dirname, 'node_modules/.bin/closure');
  var global_closure = shell.which('closure');

  var command = '';
  var command_args = [];

  if (fs.existsSync(local_closure_path)) {
    if (be_verbose) {
      runner.log('Local fast-closure-compiler installation found\n');
    }
    command = local_closure_path;

  } else if (global_closure) {
    if (be_verbose) {
      runner.log('Global fast-closure-compiler installation found\n');
    }
    command = global_closure;

  } else if (shell.which('java')) {
    if (be_verbose) {
      runner.log('No fast-closure-compiler installation found\n');
    }

    var jar_path = closure_compiler_dirname + '/compiler.jar';
    if (fs.existsSync(jar_path)) {
      if (be_verbose) {
        runner.log('Google Closure Compiler jar found\n');
      }
      command = 'java';
      command_args.push('-jar', jar_path);
    } else {
      callback(new Error('Cannot find \033[0;31mGoogle Closure Compiler\033[0m'), null);
      return;
    }

  } else {
    callback(new Error('Cannot find \033[0;31mjava\033[0m'), null);
    return;
  }

  callback(null, function (flags, callback) {
    for (var key in flags) {
      var value = flags[key];
      if (Array.isArray(value)) {
        value.forEach(function (val) {
          if (val === true) {
            command_args.push('--' + key);
          } else {
            command_args.push('--' + key + '=' + val);
          }
        });
      } else {
        if (value === true) {
          command_args.push('--' + key);
        } else {
          command_args.push('--' + key + '=' + value);
        }
      }
    }

    if (be_verbose) {
      runner.log('Compilation command:\n\033[2;38m');
      runner.log(command + ' \\\n  ');
      runner.log(command_args.join(' \\\n  ') + '\033[0m\n');
    }

    child(command, command_args, function (err, result) {
      if (err) {
        callback(err, null);
      } else {
        callback(null, result.stderr);
      }
    });
  });
};
