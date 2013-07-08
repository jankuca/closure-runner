var fs = require('fs');
var path = require('path');


var Runner = function (app, args, stderr) {
  this.app_ = app;
  this.args_ = args || { _: [] };
  this.stderr = stderr || new ProcessOutput(process.stderr);

  this.output_path_ = app['output'];
  this.source_map_path_ = app['output.source-map'] || null;
  this.app_namespaces_ = app['namespaces'].slice();
  this.roots_ = app['roots'].slice();

  this.project_dirname_ = null;
  this.closure_compiler_dirname_ = null;
  this.closure_library_dirname_ = null;

  this.stack_dirname_ = path.resolve(__dirname, '..');

  this.tasks_ = {};
  this.running_tasks_ = [];
};


Runner.prototype.getStackDirname = function () {
  return this.stack_dirname_;
};


Runner.prototype.getTempDirname = function () {
  var temp_dirname = path.join(this.getStackDirname(), 'temp');
  if (!fs.existsSync(temp_dirname)) {
    fs.mkdirSync(temp_dirname);
  }

  return temp_dirname;
};


Runner.prototype.setProjectDirname = function (project_dirname) {
  this.project_dirname_ = project_dirname || null;
};


Runner.prototype.getProjectDirname = function () {
  return this.project_dirname_;
};


Runner.prototype.setSourceMapPath = function (source_map_path) {
  this.source_map_path_ = source_map_path || null;
};


Runner.prototype.getSourceMapPath = function () {
  return this.path(this.source_map_path_);
};


Runner.prototype.setOutputPath = function (output_path) {
  this.output_path_ = output_path || null;
};


Runner.prototype.getOutputPath = function () {
  return this.path(this.output_path_);
};


Runner.prototype.setClosureCompilerDirname = function (compiler_dirname) {
  this.closure_compiler_dirname_ = compiler_dirname || null;
};


Runner.prototype.getClosureCompilerDirname = function () {
  return this.path(this.closure_compiler_dirname_);
};


Runner.prototype.setClosureLibraryDirname = function (library_dirname) {
  this.closure_library_dirname_ = library_dirname || null;
};


Runner.prototype.getClosureLibraryDirname = function () {
  return this.path(this.closure_library_dirname_);
};


Runner.prototype.addAppNamespace = function (ns) {
  if (this.app_namespaces_.indexOf(ns) === -1) {
    this.app_namespaces_.push(ns);
  }
};


Runner.prototype.getAppNamespaces = function () {
  return this.app_namespaces_.slice();
};


Runner.prototype.addRoot = function (root) {
  if (this.roots_.indexOf(root) === -1) {
    this.roots_.push(root);
  }
};


Runner.prototype.getRoots = function () {
  return this.roots_.slice();
};


Runner.prototype.setTasks = function (tasks) {
  this.tasks_ = tasks;
};


Runner.prototype.path = function (path) {
  var runner_dirname = this.stack_dirname_;
  path = path.replace('{runner_dirname}', runner_dirname);

  return path;
};


Runner.prototype.getTask_ = function (task_id) {
  var task_desc = this.tasks_[task_id];
  if (!task_desc) {
    throw new Error('Unknown task \033[0;31m' + task_id + '\033[0m');
  }

  var task = {};
  task.id = task_id;
  task.filename = this.path(task_desc.filename);
  task.shadow = task_desc.shadow;

  var run = require(path.join(task.filename));
  task.run = run.bind(null, this, this.args_);

  return task;
};


Runner.prototype.runTask = function (task_id, callback) {
  var stderr = this.stderr;
  var running_tasks = this.running_tasks_;
  var be_verbose = !!this.args_['v'];

  var task = this.getTask_(task_id);

  if (be_verbose || running_tasks.length === 0 || !task.shadow) {
    stderr.write('\033[4;36mRunning task ');
    stderr.write('\033[4;1;36m' + task.id + '\033[0m\n');
    stderr.indent();
  }

  running_tasks.push(task.id);

  task.run(function (err) {
    running_tasks.pop();

    if (be_verbose || running_tasks.length === 0 || !task.shadow) {
      if (!err) {
        stderr.outdent();
        stderr.write('\033[0;32mok\033[0m\n');
      } else {
        stderr.write(err.message + '\n');
        stderr.outdent();
        process.exit(1);
      }
    }

    callback.apply(err, arguments);
  });
};


module.exports = Runner;