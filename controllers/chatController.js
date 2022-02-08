require("dotenv").config();
const request = require("request");
const { v4: uuidv4 } = require('uuid');
const Message = require("../models/Message");


// global variables used for conversation information
let USER_FIRST_NAME = "";
let USER_BIRTH_DATE = "";
let LATEST_MESSAGE = "";
let PREV_OF_LATEST = "";
let PREV_OF_PREV = "";
let WEBHOOK_MESS = "";
let MESSAGE_ID = "";
let SENDER_ID = "";
let COUNT_MESSAGES = 0;

function checkInDB(arrMess, givenId = SENDER_ID) {
    for (let i = 0; i < arrMess.length; i++) {
        if (arrMess[i].senderId === givenId) {
            return i;
        }
    }
    return -1;
}

let postMessage = (req, res) => {
    if ((COUNT_MESSAGES % 2) == 0)
        return;

    let MongoClient = require('mongodb').MongoClient;

    // creating the message object
    let obj = new Message({
        senderId: SENDER_ID,
        messages: [{MESSAGE_ID: WEBHOOK_MESS}]
    });

    console.log("OBJ: " + obj);

    MongoClient.connect(
        process.env.DB_CONNECTION, {
        auth: {
            user: process.env.MONGO_DB_USER,
            password: process.env.MONGO_DB_PASSWORD
        }
    },
        {
            useNewUrlParser: true,
            useUnifiedTopology: true
        },
        function (err, client) {
            if (err) {
                throw err;
            }

            console.log("DB Connected");

            // Get database name
            let db = client.db(process.env.DB_NAME);

            // we search if user already in database
            db.collection(process.env.DB_COLLECTION).find({}).toArray(function (err, result) {
                if (err) {
                    throw err;
                }

                console.log("Display data: " + result);

                // check whether user is in DB
                let posInDB = checkInDB(result);

                // if user is not in DB
                if (posInDB < 0) {
                    db.collection(process.env.DB_COLLECTION).insertOne(obj, function (error, res) {
                        if (error) {
                            throw error;
                        }

                        // console.log("1 message inserted for not in DB userId=" + SENDER_ID);
                        client.close();
                    });
                }
                // user is in DB
                else {
                    let usrArrMess = result[posInDB].text;
                    console.log("User messages: " + usrArrMess);

                    let newText = [];
                    for (let i = 0; i < usrArrMess.length; i++)
                        newText.push(usrArrMess[i]);
                    newText.push(WEBHOOK_MESS);

                    // or with spread operator
                    // newText = [...usrArrMess];

                    db.collection(process.env.DB_COLLECTION).update(
                        { _id: result[posInDB]._id },
                        { $set: { messages: newText } }
                    )

                    console.log("1 message inserted for in DB userId=" + SENDER_ID);
                    client.close();
                }
            });
        }
    );
}

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
                MESSAGE_ID = webhook_event.message.uuidv4();

                postMessage(req, res);
                handleMessage(sender_psid, webhook_event.message);
            } 
            // else if (webhook_event.postback) {
            //     COUNT_MESSAGES += 1;

            //     postMessage(req, res);
            //     WEBHOOK_MESS = webhook_event.postback.payload;
            //     handlePostback(sender_psid, webhook_event.postback);
            // }

        });

        // Return a '200 OK' response to all events
        res.status(200).send('EVENT_RECEIVED');

    } else {
        // Return a '404 Not Found' if event is not from a page subscription
        res.sendStatus(404);
    }
};

function countWords(str) {
    var matches = str.match(/[\w\d\’\'-]+/gi);
    return matches ? matches.length : 0;
}

function extractName(givenName = PREV_OF_LATEST) {
    let name = "";
    for (let i = 3; i < givenName.length; i++) {
        if (givenName[i] === ' ') break;

        name += givenName[i];
    }
    return name;
}

function extractDate(givenDate = PREV_OF_LATEST) {
    let dt = "";
    for (let i = 3; i < givenDate.length; i++) {
        if (givenDate[i] === ' ') break;

        dt += givenDate[i];
    }
    return dt;
}

function countBirthDays(birthDate = USER_BIRTH_DATE) {
    var today = new Date();

    // we extract user birth date information in decimal
    var user_year = parseInt(birthDate.substring(0, 4), 10);
    var user_month = parseInt(birthDate.substring(5, 7), 10);
    var user_day = parseInt(birthDate.substring(8, 10), 10);

    // bad information introduced
    if (user_year >= today.getFullYear() || user_month > 12 || user_day > 31) {
        return -1;
    }
    else { // valid information -> proceed to calculus
        const oneDay = 24 * 60 * 60 * 1000; // hours*minutes*seconds*milliseconds
        let days_left = Math.round(Math.abs(((today - new Date(today.getFullYear(), user_month - 1, user_day)) / oneDay)));

        return days_left;
    }
}

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
            callSendAPI(sender_psid, `This bot doesn't understand "${message.text}". Try to say "Hi" or "#Start_Again" to restart the conversation..`);
        }
    }
    catch (error) {
        console.error(error);
        callSendAPI(sender_psid, `An error has occured: '${error}'. We have been notified and will fix the issue shortly!`);
    }
}

function handleTextMessage(sender_psid, message) {
    // getting current message
    let mess = message.text;
    mess = mess.toLowerCase();

    PREV_OF_PREV = PREV_OF_LATEST;
    PREV_OF_LATEST = LATEST_MESSAGE;
    LATEST_MESSAGE = mess;

    // message.nlp did not work -> made a workaround
    let greeting = ["hello", "hi", "hey"];
    let accept_conv = ["yup", "yes", "yeah", "sure", "yep", "i do"];
    let deny_conv = ["no", "nah", "nope", "notnow", "maybe later"];
    let thanks_conv = ["thanks", "thx", "thank you", "thank you very much", "thanks a lot", "thanks!", "thank you!"];

    let resp;

    // reinitialize conversation
    if (mess === "#Start_Again") {
        USER_FIRST_NAME = "";
        USER_BIRTH_DATE = "";
        LATEST_MESSAGE = "";
        PREV_OF_LATEST = "";
        PREV_OF_PREV = "";
    }

    // greeting case
    if (greeting.includes(mess) || mess === "#Start_Again") {
        if (USER_FIRST_NAME === "") {
            resp = {
                "text": "(Hello There!! Would you like to answer few questions?",
                "quick_replies": [
                    {
                        "content_type": "text",
                        "title": "Yes Ofcourse",
                        "payload": "yesofcourse"
                    }, {
                        "content_type": "text",
                        "title": "Not Now, sometimes later",
                        "payload": "notnow"
                    }
                ]
            }
            callSendAPI(sender_psid, ``, resp);
        } else {
            callSendAPI(sender_psid, `This bot doesn't understand "${message.text}". Try to say "Hi" or "#Start_Again" to restart the conversation.`);
        }

    }
    // accept case
    else if (accept_conv.includes(mess)) {
        if (USER_FIRST_NAME === "") {
            if (countWords(LATEST_MESSAGE) === 1 && !greeting.includes(PREV_OF_PREV)) {
                for (var i = 0; i < accept_conv.length; i++) {
                    if (mess.includes(accept_conv[i]))
                        break;
                }

                if (i !== accept_conv.length) {
                    USER_FIRST_NAME = capitalizeFirstLetter(extractName());
                    console.log(USER_FIRST_NAME);

                    callSendAPI(sender_psid, `Thanks for confirming ${USER_FIRST_NAME}. Now, please tell me your Date Of Birth in the given format i.e. YYYY-MM-DD`);
                }
                else {
                    callSendAPI(sender_psid, `That's Awesome!! Can I know your first name?`);
                }
            }
            else {
                callSendAPI(sender_psid, `That's Awesome!! Can I know your first name?`);
            }
        }
        else if (USER_BIRTH_DATE === "") {
            if (countWords(LATEST_MESSAGE) === 1 && (extractDate().split("-").length - 1) === 2) {
                USER_BIRTH_DATE = PREV_OF_LATEST;
                console.log(USER_BIRTH_DATE);

                let resp = {
                    "text": `Thanks for confirming ${USER_FIRST_NAME}. Would you like to know how many days are left for your next birtday?`,
                    "quick_replies": [
                        {
                            "content_type": "text",
                            "title": "Yes Please",
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
            else {
                callSendAPI(sender_psid, `Thanks for confirming ${USER_FIRST_NAME}. Now, please tell me your Date Of Birth in the given format i.e. YYYY-MM-DD`);
            }
        }
        else if (USER_FIRST_NAME !== "" && USER_BIRTH_DATE !== "") {
            let days_left = countBirthDays();

            // bad information introduced
            if (days_left === -1) {
                callSendAPI(sender_psid, `You have entered an invalid Date of Birth. \n\nGoodbye 🖐\n\n If you wish to start this conversation again write "#Start_Again".`);
            }
            else {

                callSendAPI(sender_psid, `There are ${days_left} days until your next birthday. Here are some gifts you can buy for yourself 🙂`);
            }
        }
        else {
            callSendAPI(sender_psid, `This bot doesn't understand "${message.text}". Try to say "Hi" or "#Start_Again" to restart the conversation.`);
        }

    }
    // deny case
    else if (deny_conv.includes(mess)) {
        callSendAPI(sender_psid, `Thank you for your answer.\n\n Goodbye 🖐\n\n If you wish to start this conversation again write "#Start_Again".`);
    }
    // gratitude case
    else if (thanks_conv.includes(mess)) {
        callSendAPI(sender_psid, `You're welcome! If you wish to start this conversation again write "#Start_Again". Goodbye 🖐`);
    }
    // user may have introduced first name and/or birth date
    else {
        let resp;

        // if we don't know user first name yet
        if (!USER_FIRST_NAME) {
            LATEST_MESSAGE = capitalizeFirstLetter(LATEST_MESSAGE);
            resp = {
                "text": `Your first name is ${LATEST_MESSAGE}. Press "Yes" to confirm, Else press "No"`,
                "quick_replies": [
                    {
                        "content_type": "text",
                        "title": "Yes",
                        "payload": "yes"
                    }, {
                        "content_type": "text",
                        "title": "No",
                        "payload": "no"
                    }
                ]
            };

            callSendAPI(sender_psid, ``, resp);

        } // if we don't know user birth date yet
        else if (!USER_BIRTH_DATE) {
            resp = {
                "text": `Your Date of Birth is ${LATEST_MESSAGE}. Press "Yeah" to confirm, Else press "Nah"`,
                "quick_replies": [
                    {
                        "content_type": "text",
                        "title": "Yeah",
                        "payload": "yeah"
                    }, {
                        "content_type": "text",
                        "title": "Nah",
                        "payload": "nah"
                    }
                ]
            };

            callSendAPI(sender_psid, ``, resp);
        }
        // something else
        else {
            callSendAPI(sender_psid, `Thank you for your answer.\n\n Goodbye 🖐\n\n If you wish to start this conversation again write "#Start_Again".`);
        }
    }
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
            callSendAPI(sender_psid, `There are ${days_left} days until your next birthday. Here are some gifts you can buy for yourself 🙂`);
        }
    }
    else if (mess === "notnow" || mess === "no" || mess === "nah" || mess === "nothanks") {
        callSendAPI(sender_psid, `Thank you for your answer.\n\n Goodbye 🖐\n\n If you wish to start this conversation again write "#Start_Again".`);
    }
    else {
        callSendAPI(sender_psid, `This bot doesn't understand "${message.text}". Try to say "Hi" or "#Start_Again" to restart the conversation.`);
    }
}

function handleAttachmentMessage(sender_psid, message) {
    callSendAPI(sender_psid, `From handle attachment message. You said ${message.text}`);
}








module.exports = {
    postWebhook: postWebhook,
    getWebhook: getWebhook,
    postMessage: postMessage
};

