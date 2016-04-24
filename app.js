/**
 * webtask-push
 *
 * Copyright Caesar Wirth
 * Released under the MIT license
 *
 * Date: 2016-04-24
 */
var tls = require('tls');
var Express = require('express');
var Webtask = require('webtask-tools');
var app = Express();
app.use(require('body-parser').json());

/**
 * POST handler that sends a push request.
 * Requires that the SSL certificate and key be imported from the secrets.
 *
 * Reads the JSON Data passed in, and converts it to a Notification object
 * and then sends that to Apple.
 */
app.post('/', function (req, res) {
    // `cert` and `key` must be uploaded on creation to the secrets
    var cert = req.webtaskContext.secrets.cert;
    var key = req.webtaskContext.secrets.key;
    var environment = req.webtaskContext.secrets.environment;
    if (!cert || !key) {
        res.status(500).json({ error: 'Invalid Credentials' }); 
        return;
    }
    var host = 'gateway.sandbox.push.apple.com';
    if (environment == "production") {
        host = 'gateway.push.apple.com';
    }

    var params = req.body;

    // A push notification requires a destination, otherwise we cannot send it
    // Other data, such as a message, are optional, but the token is required.
    var token = params.token;
    if (!token) {
        res.status(400).json({ error: 'No destination token' }); 
        return;
    }

    // Create a new notification to send.
    // Takes the other parameters out from the JSON data passed in
    var note = new Notification(token);
    note.parseParams(params);

    // Submit the data to Apple's servers
    // Retuns an error if something goes wrong with the request.
    sendNotification(note, host, cert, key, function(success, error) {
        var result = { success: success };
        if (success) {
            res.json(result);
        } else {
            result.error = error;
            res.status(500).json(result);
        }
    });
});

// Actually use our express server as our app
module.exports = Webtask.fromExpress(app);



/**
 * Actually sends the notification to Apple.
 * Opens a socket and sends data to Apple's server.
 *
 * @param {Notification} note - The notification to send to Apple
 * @param {string} host - Host to connect to - Apple's Sandbox or Production APNS server
 * @param {string} cert - Certificate provided by Apple
 * @param {string} key - Key provided by Apple
 * @param {function} callback - Callback to be called when the call is complete.
 *                              Has the signature:
 *
 *                              function(success, error) { }
 *
 *                              Success is a boolean signifying whether the connection succeeded
 *                              Error will be the error that occurred if it failed
 */
function sendNotification(note, host, cert, key, callback) {
    var options = {
        cert: cert,
        key: key,
        host: host,
        port: 2195
    };

    var socket = tls.connect(options, function() {
        var success = false;
        var error = null;
        if (socket.authorized) {
            var data = note.serialize();
            socket.write(data);
            success = true;
        } else {
            console.log('Did not successfully connect: ' + socket.authorizationError);
            error = socket.authorizationError;
        }
        socket.end();
        callback(success, error);
    });
}


/**
 * Notification Object
 * Contains the information needed to send the data to Apple
 *
 * @constructor
 * @param {string} token - Token for the device to send the notifcation to
 */
function Notification(token) {
    this.token = new Buffer(token, 'hex');
    this.payload = {}; // Extra data to send to the user
    this.message = null; // String
    this.badge = null; // Int
    this.sound = null; // String
    this.contentAvailable = null; // Bool
}

/**
 * Reads the notification data out of the parameters, and updates itself
 * @param {object} params - Parameters containing the data for the notification
 */
Notification.prototype.parseParams = function(params) {
    this.payload = params.payload;
    this.message = params.message;
    this.badge = params.badge;
    this.sound = params.sound;
    this.contentAvailable = params.contentAvailable;
};

/**
 * Creates the representation of this Notification that should be sent to Apple.
 * Includes all the data that is available, and puts them in their proper place.
 * It skips keys that are not available.
 */
Notification.prototype.apsData = function() {
    var data = this.payload || {};
    var aps = {};
    if (this.message) {
        aps.alert = this.message;
    }
    if (this.badge || this.badge === 0) {
        aps.badge = this.badge;
    }
    if (this.sound) {
        aps.sound = this.sound;
    }
    if (this.contentAvailable) {
        aps['content-available'] = 1;
    }
    data.aps = aps;
    return data;
};

/**
 * Serializes this Notification into a Buffer containing the actual data
 * that should be sent directly to Apple's servers.
 */
Notification.prototype.serialize = function() {
    var token = this.token;
    var json = JSON.stringify(this.apsData());     
    var jsonLength = Buffer.byteLength(json, 'utf8');

    // Binary Provider Documentation:
    // https://developer.apple.com/library/ios/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/Appendixes/BinaryProviderAPI.html
    // How the byte array is set up:
    // First 5 Bytes:
    //     Command:      1 byte  - The number 2
    //     Frame length: 4 bytes - The size of the rest of the data
    // Token Section:
    //     FieldId: 1 byte  - 1 for Device Token
    //     Length:  2 bytes - Length in bytes of the device token
    //     Data:    varies  - Device token data
    // Payload Section:
    //     FieldId: 1 byte  - 2 for Payload
    //     Length:  2 bytes - Length in bytes of the payload data
    //     Data     varies  - Payload data
    var position = 0;
    var frameLength = 3 + token.length + 3 + jsonLength;
    var data = new Buffer(5 + frameLength);
    data[position] = 2;
    position += 1;

    // Frame Length
    data.writeUInt32BE(frameLength, position);
    position += 4;
    
    // Token
    data[position] = 1;
    position += 1;
    data.writeUInt16BE(token.length, position);
    position += 2;
    position += token.copy(data, position, 0);

    // Payload
    data[position] = 2;
    position += 1;
    data.writeUInt16BE(jsonLength, position);
    position += 2;
    position += data.write(json, position, 'utf8');

    return data;
};

