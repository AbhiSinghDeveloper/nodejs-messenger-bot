const MongoClient = require('mongodb');

// variable to cache messages
let MESS_S;

// messages are cached for 1 minute
setInterval(() => {
	getAllMess();
}, 1000 * 60);

// function to get all messages
function getAllMess(){
	
	MongoClient.connect(
        process.env.DB_CONNECTION, {
            auth: {
                user: process.env.MONGO_DB_USER,
                password: process.env.MONGO_DB_PASSWORD
            }
        },
        {
            useNewUrlParser: true, 
            useUnifiedTopology: true}, 
            function(err, client) {

        if (err) throw err;
        
        console.log("Connected correctly to server for getting messages");

        // Get database name
        var db = client.db(process.env.DB_NAME);
        
        db.collection(process.env.DB_COLLECTION).find({}).toArray(function(err, res) {
            if (err) {
                throw err;
            }

			client.close();
            console.log("Displaying all messages");
			console.log(res);

			MESS_S = res;
        });
	});
}

// render messages
let getMessages = (req, res) => {
	// waiting for messages
	if (MESS_S){
		res.json({messages: MESS_S})
	}
	else{
		getAllMess();
		

		setTimeout(() => {
			// MESS_S = JSON.stringify(MESS_S);
			// res.render("ejs/messages.ejs", {messages: MESS_S});
			res.json({messages: MESS_S})
		}, 3000);
	}
};

// function to get a message with given id
function getMessageWithGivenId(mess_given_id, arr_mess=MESS_S){
	for(let x of arr_mess){
		let first = JSON.stringify(x._id);
		let second = JSON.stringify(mess_given_id);

		for(var i = 0; i < first.length; i++){
			if(first[i] !== second[i])
				break;
		}

		if (i === first.length){
			return x.text;
		}
	}
}

// render a single message
let getMessageId = async (req, res) => {
	// try {
	// 	let mess = await Message.findById(req.params.messId);
	// 	res.render("ejs/messages.ejs", {messages: mess});
	// } catch (err) {
	// 	res.json({message: err});
	// }
	
	let msg = "";
	
	function sendMess(){
		msg = getMessageWithGivenId(req.params.messId);
		if (msg !== ""){
			// res.render("ejs/messages.ejs", {messages: msg});
			res.json({messages: msg})
		}
		else{
			// res.render("ejs/messages.ejs", {messages: "Message does not exist"});
			res.json({messages: "Message does not exist"})
		}
	}

	if (MESS_S){
		sendMess();
	}
	else{
		getAllMess();
		
		setTimeout(() => {
			sendMess();
		}, 3000);
	}
};

// delete a single message
// let deleteMessageById = async (req, res) => {
// 	// try {
// 	// 	const removed_message = await Message.remove({_id: req.params.messId});
// 	// 	res.json(removed_message);
// 	// } catch (error) {
// 	// 	res.json({message: error});
// 	// }

// 	let msg = "";
	
// 	function deleteMess(){
// 		msg = getMessageWithGivenId(req.params.messId);

// 		if (msg !== ""){
// 			MongoClient.connect(
// 				process.env.DB_CONNECTION, {
// 					auth: {
// 						user: process.env.MONGO_DB_USER,
// 						password: process.env.MONGO_DB_PASSWORD
// 					}
// 				},
// 				{
// 					useNewUrlParser: true, 
// 					useUnifiedTopology: true}, 
// 					function(err, client) {
		
// 				if (err) throw err;
				
// 				console.log("Connected correctly to server for deleting the message");
		
// 				// Get database name
// 				var db = client.db(process.env.DB_NAME);
// 				var my_query = { text: msg};

// 				db.collection(process.env.DB_COLLECTION).deleteOne(my_query, function(err, res) {
// 					if (err) {
// 						throw err;
// 					}
		
// 					// recache messages
// 					getAllMess();

// 					client.close();
// 					console.log("Deleted 1 message");

// 				});
// 			});
			
// 			res.render("ejs/messages.ejs", {messages: "Message deleted"});
// 		}
// 		else{
// 			res.render("ejs/messages.ejs", {messages: "Message does not exist"});
// 		}
// 	}

// 	if (MESS_S){
// 		deleteMess();
// 	}
// 	else{
// 		getAllMess();
		
// 		setTimeout(() => {
// 			deleteMess();
// 		}, 3000);
// 	}
// };

module.exports = {
	getMessages: getMessages,
	getMessageId: getMessageId,
	// deleteMessageById: deleteMessageById
};

// module.exports = getMessageWithGivenId;