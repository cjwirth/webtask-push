# webtask-push

A small webtask to be run on [webtask.io](https://webtask.io/) to send push notifications.

## Setup

### Get Push Notification Certificate + Key
First you will need to setup push notifications for your device. If you need help with this part, there is a good [tutorial on Ray Wenderlich's site](https://www.raywenderlich.com/123862/push-notifications-tutorial) that you can go through.

You will also need the certificate and key provided by Apple for push notifications. You can get them from the [Developer Center](https://developer.apple.com/account/ios/certificate/) or use [fastlane](https://fastlane.tools/) to create them for you.

We're going to pretend that you named them `cert.pem` and `key.pem` and that they are in the same directory as `app.js`. 

### Crete Webtask

This should be pretty easy assuming you have webtask's [wt-cli](https://webtask.io/cli) installed.

All you have to do is create a new webtask, passing in your certificate and key as secrets to it.

~~~
$ wt create app.js --name push --no-parse --no-merge --secret cert="$(cat cert.pem)" --secret key="$(cat key.pem)"
~~~

*Make sure you include the `cert` and `key` in your secret as well as `--no-parse` and `--no-merge`, because Express is being used inside!*

## Use

`webtask-push` provides 1 simple API endpoint that you can call to send a push request. 

All you have to do is send a POST request to your webtask URL with some JSON data in the body. `webtask-push` will forward the data to Apple's servers, and send the notification to your app.

While the only *required* parameter is `token`, it probably doesn't make sense to send an empty notification to your app.

Here is an example of a possible JSON object with all supported properties filled in:

~~~ json
{
    "token": "DEVICE_TOKEN",
    "message": "Your opponent just made a move! Check it out!",
    "badge": 1,
    "sound": "alert.aiff",
    "contentAvailable": true,
    "payload": {
        "opponentPosition": {
            "x": 3,
            "y": 16
        }
    }
}
~~~

This would get parsed, and sent to Apple. The resulting information you would receive in the `userInfo` in your iOS app would look like:

~~~ json
{
    "aps": {
        "alert": "Your opponent just made a move! Check it out!",
        "badge": 1,
        "sound": "alert.aiff",
        "content-available": 1
    },
    "opponentPosition": {
        "x": 3,
        "y": 16
    }
}
~~~

### Parameter Reference

**token** - _Required_ - Device Token for the device you want to send the message to.

**message** - Message to display in the alert when the message is received.

**badge** - The number to display in the badge on the app icon. There will be no change if no data is sent. The badge will disappear if you send 0;

**sound** - The sound included in your app to play when the notification is received.

**contentAvailable** - Whether or not there is content to be downloaded. `true` is the only value that will do anything. 

*The parameters above correspond directly to the values in the `aps` dictionary specified in the [Push Notification Documentation](https://developer.apple.com/library/ios/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/Chapters/TheNotificationPayload.html)*

**payload** - JSON Object that contains any other data that you want to send along with the notification. All the data inside here will be at the same level as the `aps` object in the data received in your iOS app.

## License

webtask-push is released under the MIT License. See [LICENSE.md](./LICENSE.md) for details.

