
//
// FILESORT.JS
//
// Script to organize files on your operating system.  given a source directory and a destination directory,
// this will copy or move all the files form source into the destination and place them in folders based
// on year and month
//
// - 2015
// ---- January
// ---- February
// - 2011
// ---- November
// ---- December
//
// Only creates folders as needed. 
// 
// Command Line options
//
// --srcdir <full path to source directory>
// --destdir <full path to destination directory>
// --picdir <relative path based on the base directory in the source code below (argv.picdir)
// -m  indicates move files instead of copying (file is moved, and does not remain in original directory). Default is to copy.
// -f  indicates to overwrite existing files of the same name.  Default is to not copy over existing files with the same name.
//
//
// Tests
// NODE_ENV='test' mocha test/filesort_test.js --reporter spec
//


var fs = require("fs.extra");

var _ = require("underscore");
var async = require("async");
var moment = require("moment");
var argv = require("minimist")(process.argv.slice(2));
var mv = require("mv");
var filesortUtil = require("./filesort_util.js");

var ROOTPATH = null;
var NEW_PATH = null;
var DO_MOVE = false;
var FORCE_COPY = false;

if (argv.picdir) {
	ROOTPATH = "C:/Users/Tim/Pictures/" + argv.picdir;
}
if (argv.srcdir) {
	ROOTPATH = argv.srcdir;
}
if (argv.destdir) {
	NEW_PATH = argv.destdir;
}
if (argv.m) {
	DO_MOVE = true;
}
if (argv.f) {
	FORCE_COPY = true;
}

var PROCESSING = {};
var FILE_RECORDS = [];

var STATS = {
	candidates: 0,
	copied: 0,
	notCopied: 0
}

if (!ROOTPATH || !NEW_PATH) {
	console.log("Must specify both --srcdir and --destdir");
	process.exit(1);
}

// start the party
filesortUtil.checkCreateDirSync(NEW_PATH);
processDirectory(ROOTPATH);
var globalTimer = setInterval(checkComplete, 200);

function checkComplete() {

	if (Object.keys(PROCESSING).length == 0) {
		clearInterval(globalTimer);
		console.log(FILE_RECORDS.length + " files ready to process");
		STATS.candidates = FILE_RECORDS.length;
		console.log("Copying Files...");
		//
		// copy files to new directories
		var options = {
			path: NEW_PATH,
			moveNotCopy: DO_MOVE,
			forceCopy: FORCE_COPY
		}
		filesortUtil.copyFilesToNewLocation(FILE_RECORDS, options, STATS, function(err) {
			if (err) {
				console.log("A file failed to copy, aborted. ERR=" + err);
				process.exit(2);
			} else {
				console.log("\nSUCCESS, " + STATS.copied + " files copied, " + STATS.notCopied + " files not copied/ignored");
				process.exit(0);
			}
		});
	} else {
		console.log("still working...");
	}
}

function processDirectory(dir) {

	if (dir === NEW_PATH) {
		console.log("Source Directory is same as destination directory.  Ignoring");
	} else {
		PROCESSING[dir] = "processing";
		_processDirectory(dir, function(err, data) {
			console.log("");
			console.log("Directory: " + dir + " processed successfully");
			console.log("Created " + data.length + " records");

			FILE_RECORDS = FILE_RECORDS.concat(data);
			delete PROCESSING[dir];
		});
	}	
}

function _processDirectory(dir, pdCallback) {

	console.log ("Reading Directory: " + dir);
	var timer = setInterval(function(){process.stdout.write(".");}, 500);

	fs.readdir(dir, function(err, files) {
	    if (err) {
	        console.log ("Error reading directory: " + dir);
	        console.log(err);
	        process.exit(1);
	    }

	    clearInterval(timer);

	    console.log(files.length + " files found");
	    console.log("Processing Files");

	    async.map(files, function(file, callback) {

	    	var fileObj = {};
	    	fileObj.fullPath = dir + "/" + file;
	    	fileObj.file = file;

			fs.stat(fileObj.fullPath, function(err, stats) {
				if (stats.isDirectory()) {
					//
					// don't copy the destination directory
					if (fileObj.fullPath !== NEW_PATH) {
						processDirectory(fileObj.fullPath);
					} else {
						console.log ("Found destination path in source path, ignoring");
					}
					callback(null, null);  // turn directory into NULL
				} else if (stats.isFile()) {
					fileObj.year = moment(stats.mtime).format("YYYY");
					fileObj.month = moment(stats.mtime).format("MMMM");
					// if the filename contains the date, use it instead of
					// the stats since it may not reflect the actual picture take date
					filesortUtil.validateAgainstFilename(fileObj);
					callback(null, fileObj);
					return;
				} else {
					callback(null, null);
					return;
				}	
			});
	    }, function(err, results) {
	    	pdCallback(err, results)
	    });
	});
}
