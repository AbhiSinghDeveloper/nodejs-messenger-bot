require("dotenv").config();
const request = require("request");

let getWebhook = (req, res) => {
    // Your verify token. Should be a random string.
    let VERIFY_TOKEN = process.env.VERIFY_TOKEN;

    // Parse the query params
    let mode = req.query['hub.mode'];
    let token = req.query['hub.verify_token'];
    let challenge = req.query['hub.challenge'];

    // Checks if a token and mode is in the query string of the request
    if (mode && token) {

        // Checks the mode and token sent is correct
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {

            // Responds with the challenge token from the request
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);

        } else {
            // Responds with '403 Forbidden' if verify tokens do not match
            res.sendStatus(403);
        }
    }
};

let postWebhook = (req, res) => {
    // Parse the request body from the POST
    let body = req.body;

    // Check the webhook event is from a Page subscription
    if (body.object === 'page') {

        // Iterate over each entry - there may be multiple if batched
        body.entry.forEach(function (entry) {

            // Gets the body of the webhook event
            let webhook_event = entry.messaging[0];
            console.log(webhook_event);

            // Get the sender PSID
            let sender_psid = webhook_event.sender.id;
            SENDER_ID = webhook_event.sender.id;
            console.log('Sender PSID: ' + sender_psid);

            // Check if the event is a message or postback and
            // pass the event to the appropriate handler function
            if (webhook_event.message) {
                COUNT_MESSAGES += 1;

                WEBHOOK_MESS = webhook_event.message.text;

                postMessage(req, res);
                handleMessage(sender_psid, webhook_event.message);
            } else if (webhook_event.postback) {
                COUNT_MESSAGES += 1;

                postMessage(req, res);
                WEBHOOK_MESS = webhook_event.postback.payload;
                handlePostback(sender_psid, webhook_event.postback);
            }

        });

        // Return a '200 OK' response to all events
        res.status(200).send('EVENT_RECEIVED');

    } else {
        // Return a '404 Not Found' if event is not from a page subscription
        res.sendStatus(404);
    }
};

function callSendAPI(sender_psid, response, quick_reply = { "text": "" }) {
    // Construct the message body
    let request_body;

    if (!quick_reply.text) {
        request_body = {
            "recipient": {
                "id": sender_psid
            },
            "message": { "text": response }
        };
    }
    else {
        request_body = {
            "recipient": {
                "id": sender_psid
            },
            "messaging_type": "RESPONSE",
            "message": quick_reply
        };
    }


    // Send the HTTP request to the Messenger Platform
    request({
        "uri": "https://graph.facebook.com/v7.0/me/messages",
        "qs": { "access_token": process.env.PAGE_ACCESS_TOKEN },
        "method": "POST",
        "json": request_body
    }, (err, res, body) => {
        if (!err) {
            console.log('message sent!');
        } else {
            console.error("Unable to send message:" + err);
        }
    });
}

function callSendPromo(sender_psid, quick_reply) {
    // Construct the message body
    let request_body = {
        "recipient": {
            "id": sender_psid
        },
        "messaging_type": "RESPONSE",
        "message": quick_reply
    };

    // Send the HTTP request to the Messenger Platform
    request({
        "uri": "https://graph.facebook.com/v7.0/me/messages",
        "qs": { "access_token": process.env.PAGE_ACCESS_TOKEN },
        "method": "POST",
        "json": request_body
    }, (err, res, body) => {
        if (!err) {
            console.log('message sent!');
        } else {
            console.error("Unable to send message:" + err);
        }
    });
}

function handleMessage(sender_psid, message) {
    // check kind of message
    try {
        if (message.quick_reply) {
            handleQuickReply(sender_psid, message);
        } else if (message.attachments) {
            handleAttachmentMessage(sender_psid, message);
        } else if (message.text) {
            handleTextMessage(sender_psid, message);
        }
        else {
            callSendAPI(sender_psid, `The bot needs more training. You said "${message.text}". Try to say "Hi" or "#start_over" to restart the conversation..`);
        }
    }
    catch (error) {
        console.error(error);
        callSendAPI(sender_psid, `An error has occured: '${error}'. We have been notified and will fix the issue shortly!`);
    }
}





module.exports = {
    postWebhook: postWebhook,
    getWebhook: getWebhook
};

