# Closure Runner

Closure Runner is a lightweight task runner that by default provides tasks for working with Google Closure Tools, mainly the Closure Compiler.

The idea is to simplify and streamline the workflow with Google Closure Tools while allowing projects to define custom tasks. Custom tasks can be run either side-by-side with the provided ones or they can run the provided tasks as sub-tasks and work with their output.

## Installation

The runner is based on node.js so the preferred installation method is via NPM:

    npm install closure-runner

## Usage

When installed globally, Closure Runner is invoked via the `runner` executable installed by NPM to your `$PATH`.

    $ runner task-name

When installed locally to the project, you can invoke it as

    $ node_modules/.bin/runner task-name

You will probably want to specify an NPM script in your `package.json` file for local installations:

```json
{
  "scripts": {
    "test": "node_modules/.bin/runner test"
  }
}
```

Note that you need to run the commands from the root directory of your project.

## Project Configuration

The runner looks for a `client.json` file in the project root.

```json
{
  "app": {
    "output": "./build/app.js",
    "namespaces": [ "app" ],
    "roots": [
      "./app/js",
      "./lib"
    ]
  },
  "closure-library": "./lib/closure-library"
}
```

The configuration above the minimum which you need to provide.

- `app` – information about the application
    - `output` – the JavaScript compilation output path
    - `output.source-map` – the source map output path for debugging compiled code
    - `namespaces` – the entry point namespaces for the application (a `goog.provide` symbol)
    - `roots` – the paths to search for JavaScript files
- `apps`:`[ app, app, … ]` – for multiple applications
- `closure-library` – the path to Google Closure Library
- `tasks.*`:`./tasks/*.js` – custom task definition (see below)

## Provided Tasks

- `compile` - compiles JavaScript code (files returned by the `scopify` task)

### Provided Shadow Tasks

*Shadow tasks* are tasks that can only be run as sub-tasks.

- `get-closure-compiler` – returns a function with the signature of `compile(flags: Object.<string, string|Array.<string>>, callback: function(err))`
- `sources` – lists all JavaScript files that would get compilation; returns a list of files
- `scopify` – wraps all JavaScript files in a `goog.scope` wrapper to allow CommonJS-like aliasing; returns a list of files

## Custom Tasks

The project can provide its own tasks that can be run via Closure Runner. A task is a node.js module that exports a function.

```js
module.exports = function (runner, args, callback) {
  doCoolShit(function (err) {
    callback(err, 'result');
  });
};
```

The first argument is a `ClosureRunner.Runner` instance populated with the application info. If you define multiple apps in the `client.json` configuration file, the task is invoked for each of the app individually in sequence with correctly populated `Runner` instances. See the public API of `Runner` below for more info about what is this object good for.

The second argument is an object containing parsed runner arguments passed to the process on invocation. The utilized argument parser is [node-optimist](https://github.com/substack/node-optimist).

For instance, if you need to provide the task with custom data, you can for example pass `--awesome-data 1234` to the `runner` executable an access this value as `args['awesome-data']`.

Note that the `v` runner argument is a boolean reserved for switching to *verbose reporting mode*. Custom tasks are encouraged to provide useful debug information in this mode.

All tasks are run in a asynchronous manner so the last argument is a callback function for the task to call when the task completes. You can pass any number or arguments to the callback function for *inter-task communication*. (See the public API of `Runner` below.)

To register a custom task, add a `tasks.*` link to the `client.json` configuration file. Example:

    "tasks.my-awesome-task": "./tasks/awesome.js"

This would make the task invocable as `runner my-awesome-task`.

## Public Runner API

Each task is passed a `Runner` instance as the first argument. You will want to use some of its methods in most cases.

- `Runner#getProjectDirname(): string` – returns the root directory path of the project
- `Runner#getOutputPath(): string` – returns the JavaScript compilation output path
- `Runner#getSourceMapPath(): string` – returns the source map path
- `Runner#getAppNamespaces(): Array.<string>` – returns a list of the entry point namespaces of the application
- `Runner#getRoots(): string` – returns the paths in which to look for JavaScript files of the application
- `Runner#runTask(task_id: string, callback: function(err, …))` – runs a task as a sub-task
    - The arguments passed to the callback function of the sub-task are passed to the provided callback function. The provided callback function is basically passed to the sub-task as the last argument.
- `Runner#log(chunk: string)` – writes to the stderr stream
