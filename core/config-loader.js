var fs      = require('fs'),
    url     = require('url'),
    when    = require('when'),
    path    = require('path'),
    errors  = require('./server/errorHandling');

function writeConfigFile() {
    var written = when.defer();

    /* Check for config file and copy from config.example.js
        if one doesn't exist. After that, start the server. */
    fs.exists('config.example.js', function checkTemplate(templateExists) {
        var read,
            write;

        if (!templateExists) {
            return errors.logError(new Error('Could not locate a configuration file.'), process.cwd(), 'Please check your deployment for config.js or config.example.js.');
        }

        // Copy config.example.js => config.js
        read = fs.createReadStream('config.example.js');
        read.on('error', function (err) {
            return errors.logError(new Error('Could not open config.example.js for read.'), process.cwd(), 'Please check your deployment for config.js or config.example.js.');
        });
        read.on('end', written.resolve);

        write = fs.createWriteStream('config.js');
        write.on('error', function (err) {
            return errors.logError(new Error('Could not open config.js for write.'), process.cwd(), 'Please check your deployment for config.js or config.example.js.');
        });

        read.pipe(write);
    });

    return written.promise;
}

function validateConfigEnvironment() {
    var envVal = process.env.NODE_ENV || 'undefined',
        config,
        parsedUrl;

    try {
        config = require('../config')[envVal];
    } catch (ignore) {

    }

    // Check if we don't even have a config
    if (!config) {
        errors.logError(new Error('Cannot find the configuration for the current NODE_ENV'), "NODE_ENV=" + envVal, 'Ensure your config.js has a section for the current NODE_ENV value');
        return when.reject();
    }

    // Check that our url is valid
    parsedUrl = url.parse(config.url || 'invalid');
    if (!parsedUrl.protocol || !parsedUrl.host) {
        errors.logError(new Error('Your site url in config.js is invalid.'), config.url, 'Please make sure this is a valid url before restarting');
        return when.reject();
    }

    // Check that we have database values
    if (!config.database) {
        errors.logError(new Error('Your database configuration in config.js is invalid.'), JSON.stringify(config.database), 'Please make sure this is a valid Bookshelf database configuration');
        return when.reject();
    }

    // Check for valid server host and port values
    if (!config.server || !config.server.host || !config.server.port) {
        errors.logError(new Error('Your server values (host and port) in config.js are invalid.'), JSON.stringify(config.server), 'Please provide them before restarting.');
        return when.reject();
    }

    return when.resolve();
}

exports.loadConfig = function () {
    var loaded = when.defer();
    /* Check for config file and copy from config.example.js
        if one doesn't exist. After that, start the server. */
    fs.exists(path.join(__dirname, '../config.js'), function checkConfig(configExists) {
        if (configExists) {
            validateConfigEnvironment().then(loaded.resolve).otherwise(loaded.reject);
        } else {
            writeConfigFile().then(validateConfigEnvironment).then(loaded.resolve).otherwise(loaded.reject);
        }
    });
    return loaded.promise;
};
