var TrelloSuper = require("./helpers.js");
var util = require('util');
var instadate = require("instadate");
var moment = require("moment");
var yaml = require('js-yaml');

function CardRecorder(yaml_file, board){
	TrelloSuper.call(this, yaml_file, board);
	this.Stages = this.getPreAward();
	classThis = this;
}

util.inherits(CardRecorder, TrelloSuper);

var method = CardRecorder.prototype;

method.run = function(){
	classThis = this;
	classThis.t.get('/1/boards/'+this.board+'/cards', {actions: ["createCard", "updateCard"]}, function(err, cards){
		if (err) {throw err};
		_un.each(cards, function(card){
			classThis.deleteCurrentComment(card["id"]).done(function(d){
				var now = moment();
				var hasBeenUpdated = _un.findWhere(card["actions"], {type:"updateCard"});
				var daysSinceUpdate = now.diff(moment(card.actions[0].date), 'days');
				if ((daysSinceUpdate > 0 ) || (!hasBeenUpdated)){
					console.log("Write Current Comment");
					classThis.getListNameByID(card["idList"])
						.then(function(listName){
							classThis.compileCommentArtifact(card["id"], listName, "Current", card.actions[0].date, moment().format());
						});
				} else {
					console.log("Write New Phase");
					 Q.all([classThis.getListNameByID(card["idList"]), classThis.getLastList(card.actions[0]["id"])])
					 .then(function(lists){
						 var listName = lists[0]
						 var lastPhase = list[1];
						classThis.compileCommentArtifact(card["id"], listName, lastPhase, lists, card["actions"][1]["date"], card["actions"][0]["date"]);
					 });
				}
			});
		});
	});
}

method.deleteCurrentComment = function(cardID){
	var deferred = Q.defer();
	classThis.t.get('/1/cards/'+cardID+'/actions', {filter:'commentCard'}, function(err, comments){
		if(err) {deferred.reject(new Error(err));};
		_un.each(comments,function(c){
			if (c.data.text.indexOf("**Current Stage:**") != -1){
				var currentCommentID = c["id"];
			}
			if(currentCommentID){
				classThis.t.del('/1/actions/'+currentCommentID, function(err, data){
					if(err) {deferred.reject(new Error(err));};
					deferred.resolve(data);
				});
			} else {
				deferred.resolve("no delete");
			}
		});
	});
		return deferred.promise;
}



method.getLastList = function(updateListID){
	var deferred = Q.defer();
	this.t.get('/1/actions/'+updateListID, function(err, action){
		if(err) {deferred.reject(new Error(err));};
		deferred.resolve(action["data"]["listBefore"]["name"]);
	});
	return deferred.promise;
}

//Run function to build a comment
method.compileCommentArtifact = function(cardID, listName, phase, fromDate, toDate){
		var stage = _un.findWhere(classThis.Stages, {name: listName});
		var expectedTime = stage["expected_time"];
		var diffArray = classThis.calculateDateDifference(expectedTime, fromDate, toDate);
		var differenceFromExpected = diffArray[0];
		var timeTaken = diffArray[1];
		var comment = classThis.buildComment(differenceFromExpected, expectedTime, fromDate, toDate, phase, timeTaken);
		console.log(comment);
		classThis.addComment(comment, cardID);

};

method.calculateDateDifference = function(expected, lastMove, recentMove){
	var fromDate = new Date(lastMove);
	var toDate = new Date(recentMove);
	var diffDays = instadate.differenceInWorkDays(fromDate, toDate);
	return [diffDays - expected, diffDays]
}

method.buildComment = function(dateDiff, expected, lastMove, recentMove, lastList, actual){
	formatDiff = (dateDiff < 0)? "**"+dateDiff+" days**" :"`+"+dateDiff+" days`"
	msg = "**{l} Stage:** {d}. *{f} - {t}*.\n Expected days: {e} days. Actual Days spent: {a}."
		.supplant({l: lastList, d: formatDiff, e: expected, a: actual, f: moment(lastMove).format("L"), t: moment(recentMove).format("L")});
	return msg;
}

method.addComment = function(message, cardID){
	this.t.post("1/cards/"+cardID+"/actions/comments", {text: message}, function(err, data){
		if (err) {throw err};
		// 	console.log("ordering");
	 });
}





// method.findLastMoves = function(cardActions){
// 		updatedCards = _un.where(actions, {type: 'updateCard'});
// 		if (updatedCards > 1){
// 			var fromAction = updatedCards[1];
// 			var toAction = updateCards[0];
// 		} else {
// 			var fromAction = _un.findWhere(actions, {type:"createCard"});
// 			var toAction = _un.findWhere(actions, {type:"updateCard"});
// 		}
// 	return [fromAction["date"], toAction["date"]]; // From to To Date
// }





module.exports = CardRecorder;
