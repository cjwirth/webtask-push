var tls = require('tls');

module.exports = function(context, cb) {
    var cert = context.secrets.cert;
    var key = context.secrets.key;

    if(!cert || !key) {
        cb(null, "Error: Could not get credentials");
        return;
    }

    var token = context.data.token;
    if(!token) {
        cb(null, "Error: No destination");
        return;
    }
    
    var params = context.data;

    var note = new Notification(token);
    var payloadJSON = params.payload;
    note.payload = JSON.parse(payloadJSON) || {};
    note.message = params.message;
    note.badge = parseInt(params.badge);
    note.sound = params.sound;
    note.contentAvailable = params.contentAvailable == "true";

    sendNotification(note, cert, key, function(success) {
        cb(null, "Success: " + success);
    });
};

function Notification(token) {
    this.token = new Buffer(token, 'hex');
    this.payload = {}; // Extra data to send to the user
    this.message = null; // String
    this.badge = null; // Int
    this.sound = null; // String
    this.contentAvailable = null; // Bool
}

Notification.prototype.apsData = function() {
    var data = this.payload;
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

Notification.prototype.serialize = function() {
    var token = this.token;
    var json = JSON.stringify(this.apsData());     
    var jsonLength = Buffer.byteLength(json, 'utf8');

    var position = 0;
    var frameLength = 3 + token.length + 3 + jsonLength + 3 + 4;
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

    // Identifier
    data[position] = 3;
    position += 1;
    data.writeUInt16BE(4, position);
    position += 2;
    data.writeUInt32BE(0, position);
    position += 4;

    return data;
};

function sendNotification(note, cert, key, callback) {
    var options = {
        cert: cert,
        key: key,
        host: 'gateway.sandbox.push.apple.com',
        port: 2195
    };

    var socket = tls.connect(options, function() {
        var success = false;
        if (socket.authorized) {
            var data = note.serialize();
            console.log("Sending Data: " + data);
            socket.write(data);
            success = true;
        } else {
            console.log('Did not successfully connect: ' + socket.authorizationError);
        }
        socket.end();
        callback(success);
    });
}

