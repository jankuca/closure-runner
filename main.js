var async = require('async');
var path = require('path');


var Runner = require('./lib/runner');
var Environment = require('./lib/environment');
var ProcessOutput = require('./lib/process-output');


function main(callback) {
  var env = new Environment(process.env);
  var stderr = new ProcessOutput(process.stderr);

  env.addConfig(path.join(__dirname, './client.defaults.json'));
  env.addConfig(path.join(env.getProjectDirname(), './client.json'));
  env.setArguments(process.argv.slice(2));

  var project_dirname = env.getProjectDirname();

  if (env.get('use-goog-in-tasks')) {
    var closure_dirname_rel = env.get('closure-library');
    var closure_dirname = path.join(project_dirname, closure_dirname_rel);
    var goog_bootstrap_filename = path.join(
        closure_dirname, 'closure', 'goog', 'bootstrap', 'nodejs.js');

    require(goog_bootstrap_filename);
  }

  async.eachSeries(env.getApps(), function (app, callback) {
    var args = env.getArguments();
    var runner = new Runner(app, args, stderr);

    runner.setConfig(env.getConfig());
    runner.setProjectDirname(project_dirname);
    runner.setTasks(env.getTasks());

    runner.runTask('deps', function () {
      require(path.join(project_dirname, runner.getAppConfigValue('output.deps')));
      runner.runMainTask(env.getMainTaskId(), callback);
    });
  }, function (err) {
    if (err) {
      if (err.message.indexOf('\033[') !== -1) {
        stderr.write(err.message + '\n');
      } else {
        stderr.write('\033[0;31m' + err.message + '\033[0m\n');
      }
    }
    callback(err);
  });
}


function exit(err) {
  if (err) {
    process.exit(1);
  }
}


if (require.main === module) {
  main(exit);
} else {
  exports.Environment = Environment;
  exports.ProcessOutput = ProcessOutput;
  exports.Runner = Runner;

  exports.main = main.bind(null, exit);
  exports.run = main.bind(null);
}
