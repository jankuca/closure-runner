
var ProcessOutput = function (stream) {
  this.stream_ = stream;
  this.indentation_level_ = 0;
};


ProcessOutput.prototype.setIndentationLevel = function (level) {
  this.indentation_level_ = level;
};


ProcessOutput.prototype.getIndentationLevel = function () {
  return this.indentation_level_;
};


ProcessOutput.prototype.indent = function () {
  this.indentation_level_ += 1;
};


ProcessOutput.prototype.outdent = function () {
  this.indentation_level_ -= 1;
  if (this.indentation_level_ < 0) {
    this.indentation_level_ = 0;
  }
};


ProcessOutput.prototype.write = function (chunk, encoding) {
  if (encoding && encoding !== 'utf8') {
    throw new Error(
      'The stream wrapper does not support encodings other than utf8.'
    );
  }

  chunk = chunk.toString();

  var trailing_eol = /\n$/.test(chunk);
  chunk = chunk.replace(/\n$/, '');

  var indentation = new Array(this.indentation_level_ + 1).join('  ');
  if (this.trailing_eol_) {
    this.stream_.write(indentation);
  }
  this.stream_.write(chunk.replace(/\n/g, '\n' + indentation));
  if (trailing_eol) {
    this.stream_.write('\n');
  }

  this.trailing_eol_ = trailing_eol;
};


module.exports = ProcessOutput;
