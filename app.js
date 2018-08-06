const Discord = require("discord.js");
const client = new Discord.Client();
const Knex = require('knex');
const config = require("./config.json");
const request = require("request");
const second = 1000;
const pages1v1 = 3;
const pages2v2 = 1;

let discordMessages = [];
let discordMessages2v2 = [];
let lastMsg;
let data = {};
let data2v2 = {};
let recent = {};
let recent2v2 = {};
let nicknames = [];
let clock = 0;

const knex = connect();

function connect () {
    const config = {
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        database: process.env.SQL_DATABASE
    };

    if (process.env.INSTANCE_CONNECTION_NAME && process.env.NODE_ENV === 'production') {
        config.socketPath = `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`;
    }

    // Connect to the database
    const knex = Knex({
        client: 'mysql',
        connection: config
    });

    return knex;
}
function updatePlayer(player){
    knex('Players')
        .where({ BRAWL_ID: player['brawlhalla_id']})
        .update({
            NAME: player['name'],
            RANK: player['rank'],
            RATING: player['rating'],
            PEAK_RATING: player['peak_rating'],
            GAMES: player['games'],
            WINS: player['wins'],
            UPDATED: new Date().getTime()})

         .then(function(result){
             return result;
         })
}
function addDiscordID(brawl_id, discord_id){
    return knex('Players')
        .insert({
            brawl_id: brawl_id,
            discord_id: discord_id
        })
        .then(function(res){
            return 1
        })
        .catch(function (res){
            return 0
        })
}
function addNickname(brawl_id, nickname){
    return knex('Players')
        .insert({
            brawl_id: brawl_id,
            nickname: discord_id
        })
        .then(function(res){
            return 1
        })
        .catch(function (res){
            return 0
        })
}
function getMessages(){
    return knex('Messages').select().then(function(messageData){
        messages = [];
        for (let i = 0; i<messageData.length; i++){
            messages.push(messageData[i])
        }
        return messages;
    });
}
function addMessage(msgID, chID){
    return knex('Messages').insert({ MessageID : msgID, ChannelID : chID }).then()
}
function getNicknames(){
    knex('Players').select().then(function(players){
        playerData = {};
        console.log(players);
        for(let i = 0; i < players.length; i++){
            player = players[i];
            playerData[player['brawl_id']] = {
                'discord_id': player['discord_id'],
                'nickname': player['nickname'],
            }
        }
        nicknames = playerData;
    })}



setInterval(function() {
    //runs get data every 60 seconds
    if(clock % 60 === 0) {
        // addMessage(475248787926024223, 462557094411894785);
        getMessages().then(function (messages) {
            console.log(messages);
        });
        getNicknames();
        updateData(0, pages1v1 - 1, false);
    }
    //staggers the 2v2 call by 2 seconds
    // }else if((2 + clock) % 60 === 0) {
    //     updateData(0, pages2v2-1, true);
    // }
    clock++
}, second);



function updateData(currentPage, pages, is2v2 = false){
    let url = "https://api.brawlhalla.com/rankings/" + (is2v2 ? "2v2" : "1v1") + "/aus/" + (currentPage + 1) + "?api_key=" + config.brawltoken;
    console.log(url);
    request({
        url: url,
        json: true
    }, function (err, res, body) {
        if (!err && res.statusCode === 200) {

            for (let i = 0; i < body.length; i++) {
                let player = body[i];
                if(is2v2) updateList2v2(player);
                else updateList1v1(player);
            }
            if (currentPage < pages){
                updateData(currentPage + 1, pages, is2v2)
            } else{
                if(is2v2) {
                    updateRecent2v2();
                    // update.updateDiscord(discordMessages2v2, recent2v2, true);
                }else{
                    updateRecent();
                    getMessages().then(function(messages){
                        updateDiscord(messages, recent);
                    });
                }
            }
        }
    })
}

function updateRecent(){
    let d = new Date();
    for (let id in data){
        //if players has been updated in the last 10 minutes, add them
        if (d.getTime() - data[id].updated < 600000){
            recent[id] = data[id]
        }
    }
    for (let id in recent) {
        //if player has been in recent for more than 30 minutes without an update, remove them.
        if (d.getTime() - data[id].updated > 1800000) {
            delete recent[id];
        }
    }
}

function updateRecent2v2(){
    let d = new Date();
    for (let id in data2v2){
        if (d.getTime() - data2v2[id].time < 600000){
            recent2v2[id] = data2v2[id]
        }
    }
    for (let id in recent2v2) {
        if (d.getTime() - data2v2[id].time > 1800000) {
            delete recent2v2[id];
        }
    }
}

function cutName(string, is2v2=false){
    if(is2v2 && string > 20){
        let index = string.indexOf("+", 0);
        let n1 = string.substring(0,index);
        let n2 = string.substring(index+1);
        if (n1 > 18){
            n1 = n1.substring(0, 10) + ".."
        }
        if (n2 > 18){
             n2 = n2.substring(0, 10) + ".."
        }
        return n1 + "\n" + n2;
    }
    else if (string > 20){
        return string.substring(0, 18) + "..."
    }
    else return string
}

function updateList1v1(apiPlayer){
    let d = new Date();
    let player = data[apiPlayer.brawlhalla_id];

    if (apiPlayer.brawlhalla_id in data){ //if player is in the list, update them.
        player.name = apiPlayer.name; //update name regardless
        if (player.name.length > 18) player.name = player.name.substring(0, 18) + "..."; //shorten name if too long
        player.rank = apiPlayer.rank; //update rank regardless
        if (player.games !== apiPlayer.games){ //update these things only if the player has played 1 or more games.
            player.games = apiPlayer.games;
            player.peak_rating = apiPlayer.peak_rating;
            player.wins = apiPlayer.wins;
            player.old_rating = player.rating;
            player.rating = apiPlayer.rating;
            player.updated = d.getTime()
        }

    } else { //if player not in list yet add them
        data[apiPlayer.brawlhalla_id] = {
            name : apiPlayer.name,
            rank : apiPlayer.rank,
            rating : apiPlayer.rating,
            old_rating : apiPlayer.rating,
            games : apiPlayer.games,
            wins: apiPlayer.wins,
            peak_rating : apiPlayer.peak_rating,
            updated : 0 //set to 0 as we don't know when they played last.
        }
    }
}

function updateList2v2(obj){
    let d = new Date();
    let id = "" + obj.brawlhalla_id_one + obj.brawlhalla_id_two;
    if (id in data2v2){
        let player = data2v2[id];
        if (player.elo !== obj.rating){
            player.oldelo = data2v2[id].elo;
            player.time = d.getTime()
        }

        name = cutName(obj.teamname, true);
        player.rank = obj.rank;
        player.elo = obj.rating;

    } else {
        data2v2[id] = {
            name : cutName(obj.teamname, true),
            rank : obj.rank,
            oldelo : obj.rating,
            elo : obj.rating,
            time : 0,
        }
    }
}

function updateDiscord (messageList, discordList, is2v2 = false) {
    console.log("updating");
    let recentList = [];
    for (let x in discordList) {
        discordList[x].brawl_id = x;
        recentList.push(discordList[x]);

    }
    // let testplayer = { name: 'oDinked',
    //     rank: '144',
    //     rating: 1899,
    //     old_rating: 1885,
    //     games: 1002,
    //     wins: 527,
    //     peak_rating: 1994,
    //     updated: 1533429769615,
    //     brawl_id: '123123' };

    // recentList.push(testplayer);

    let sorted = recentList.sort(function (a, b) {
        return a.rank - b.rank
    });

    let d = new Date();
    let fields = [];

    let title = is2v2 ? "Brawlhalla Aus 2v2 Queue"
        : "Brawlhalla Aus 1v1 Queue";
    let desc = is2v2 ? "Displaying players in the AUS top 100 2v2 who have played ranked in the last 30 minutes.\n\u200b" //2v2 string
        : "Displaying players in the AUS top 300 1v1 who have played ranked in the last 30 minutes.\n\u200b"; //1v1 string
    //Make an entry for each recent player
    for (let i = 0; i < sorted.length; i++) {
        let elo = sorted[i].rating;
        let change = String(sorted[i].rating - sorted[i].old_rating);
        let changeSign = (change < 0) ? "" : "+"
        let tag = sorted[i].brawl_id;
        if (sorted[i].brawl_id in nicknames){
            let userID = nicknames[sorted[i].brawl_id].discord_id;
            let nick = nicknames[sorted[i].brawl_id].nickname;
            if(userID !== null) {
                tag = client.users.get(userID); //client.users.get(userID.toString());
            }else if(nick !== null){
                tag = nick
            }
        }
        let field = {
            "name": sorted[i].rank + ": " + sorted[i].name,
            "value": tag+"\n" +
                "elo: " + elo + " (" + changeSign + change + ")\n" +
                "*updated " + String(Math.floor((d.getTime() - sorted[i].updated) / 60000)) + " minutes ago*\n" +
                "\u200b",
            "inline": true
        };
        fields.push(field)
    }
    let embed = {
        "embed": {
            "title": title,
            "description": desc,
            "color": 16743647,
            "timestamp": new Date(),
            "footer": {},
            "thumbnail": {
                // "url": "https://i.imgur.com/LmdHZUg.png"
            },
            "fields": fields
        }
    };
    for (let i = 0, len = messageList.length; i < len; i++) {
        let message = messageList[i];
        let  ch = client.channels.get(message['ChannelID']);
        ch.fetchMessage(message['MessageID'])
            .then(message => message.edit(embed))

    }
}

client.on("ready", async () => {
    console.log(`Bot has started, with ${client.users.size} users, in ${client.channels.size} channels of ${client.guilds.size} guilds.`);
});


client.on("message", async message => {

    if(message.author.bot) return;

    if(message.content.indexOf(config.prefix) !== 0) return;

    const args = message.content.slice(config.prefix.length).trim().split(/ +/g);
    const command = args.shift().toLowerCase();

    if(command === "here!") {
        console.log("adding message");
        //Only allows command from certain roles
        if(!message.member.roles.some(r=>["Admin", "Yumiko"].includes(r.name)) )
        return message.reply("Sorry, you don't have permissions to use this!");

        //Deletes last 100 messages in channel
        // const fetched = await message.channel.fetchMessages({limit: 100});
        // message.channel.bulkDelete(fetched)
        //     .catch(error => message.reply(`Couldn't delete messages because of: ${error}`));

        //sends a message and adds it to the edit list.
        lastMsg = await message.channel.send("OK!");
        discordMessages.push(lastMsg);
        // update.updateDiscord(discordMessages, recent);
    }
    if(command === "addid") {
        console.log("trying to add ID");
        ok = await addDiscordID(args[0], args[1]);
        console.log(ok);

        //Only allows command from certain roles
        if(!message.member.roles.some(r=>["Admin", "Yumiko"].includes(r.name)) )
            return message.reply("Sorry, you don't have permissions to use this!");
        //
        // //Deletes last 100 messages in channel
        // const fetched = await message.channel.fetchMessages({limit: 100});
        // message.channel.bulkDelete(fetched)
        //     .catch(error => message.reply(`Couldn't delete messages because of: ${error}`));
        //
        // //sends a message and adds it to the edit list.
        let text = ok === 1? "Successfully added user!" : "Failed to add user :(";
        lastMsg = await message.channel.send(text);
        discordMessages.push(lastMsg);
        // // update.updateDiscord(discordMessages, recent);
    }
    if(command === "here2!") {
        //Only allows command from certain roles
        if(!message.member.roles.some(r=>["Admin", "Yumiko"].includes(r.name)) )
            return message.reply("Sorry, you don't have permissions to use this!");

        //sends a message and adds it to the edit list.
        lastMsg = await message.channel.send("OK!");
        discordMessages2v2.push(lastMsg);
        // update.updateDiscord(discordMessages2v2, recent2v2, true);
    }
});

client.login(config.token);