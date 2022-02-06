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

function handleQuickReply(sender_psid, message) {
    let mess = message.text;
    mess = mess.toLowerCase();

    // user agreed to answer questions
    if (mess === "yesofcourse") {
        if (!USER_FIRST_NAME) {
            callSendAPI(sender_psid, `That's Awesome!! Can I know your first name?`);
        }
        else {
            callSendAPI(sender_psid, `This bot doesn't understand "${message.text}". Try to say "Hi" or "#Start_Again" to restart the conversation.`);
        }
    }
    // user agreed on his first name
    else if (mess === "yes") {
        for (let i = 3; i < LATEST_MESSAGE.length; i++) {
            USER_FIRST_NAME += LATEST_MESSAGE[i];

            if (LATEST_MESSAGE[i] === " ") break;
        }
        USER_FIRST_NAME = capitalizeFirstLetter(USER_FIRST_NAME);
        console.log(USER_FIRST_NAME);

        callSendAPI(sender_psid, `Thanks for confirming ${USER_FIRST_NAME}. Now, please tell me your Date Of Birth in the given format i.e. YYYY-MM-DD`);
    }
    // user agreed on his birth date
    else if (mess === "yeah") {
        for (let i = 3; i < LATEST_MESSAGE.length; i++) {
            USER_BIRTH_DATE += LATEST_MESSAGE[i];

            if (LATEST_MESSAGE[i] === " ") break;
        }
        console.log(USER_BIRTH_DATE);

        let resp = {
            "text": `Thanks for confirming ${USER_FIRST_NAME}. Would you like to know how many days are left for your next birtday?`,
            "quick_replies": [
                {
                    "content_type": "text",
                    "title": "Yes Please let me know",
                    "payload": "yesplease"
                }, {
                    "content_type": "text",
                    "title": "No Thanks",
                    "payload": "nothanks"
                }
            ]
        };

        callSendAPI(sender_psid, ``, resp);
    }
    // user agreed to know birth date days
    else if (mess === "yesplease") {
        let days_left = countBirthDays();

        // bad information introduced
        if (days_left === -1) {
            callSendAPI(sender_psid, `You have entered an invalid Date of Birth. \n\nGoodbye 🖐\n\n If you wish to start this conversation again write "#Start_Again".`);
        }
        else { // valid information -> proceed to calculus

            // sending 2 carousel products
            // let resp = initialGifts();

            callSendAPI(sender_psid, `There are ${days_left} days until your next birthday. Here are some gifts you can buy for yourself 🙂`);
            // callSendPromo(sender_psid, resp);
        }
    }
    else if (mess === "notnow" || mess === "no" || mess === "nah" || mess === "nothanks") {
        callSendAPI(sender_psid, `Thank you for your answer.\n\n Goodbye 🖐\n\n If you wish to start this conversation again write "#Start_Again".`);
    }
    else {
        callSendAPI(sender_psid, `This bot doesn't understand "${message.text}". Try to say "Hi" or "#Start_Again" to restart the conversation.`);
    }
}









module.exports = {
    postWebhook: postWebhook,
    getWebhook: getWebhook
};

