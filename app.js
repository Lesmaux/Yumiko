const Discord = require("discord.js");
const client = new Discord.Client();
const config = require("./config.json");
const request = require("request");
const second = 1000;
const pages = 10;
let discordMessages = [];
let lastMsg;
let data = {};
let recent = {};
let clock = 0;

setInterval(function() {
    //runs get data every 60 seconds
    if(clock % 60 === 0) {
        getData(0, pages-1);
    }
    clock++
}, second);

function getData(currentPage, pages){
    let url = "https://api.brawlhalla.com/rankings/1v1/aus/" + (currentPage + 1) + "?api_key=" + config.brawltoken;
    request({
        url: url,
        json: true
    }, function (err, res, body) {
        if (!err && res.statusCode === 200) {
            for (let i = 0; i < body.length; i++) {
                let obj = body[i];
                updateList(obj);
            }
            if (currentPage < pages){
                getData(currentPage + 1, pages)
            } else{
                updateRecent();
                updateDiscord();
            }
        }
    })
}


function updateDiscord(){
    let recentList = [];
    for(let i in recent){
        recentList.push(recent[i])
    }

    let sorted = recentList.sort(function(a, b) {return a.rank - b.rank});

    let d = new Date();
    let fields = [];
    for(let i = 0; i < sorted.length; i++){
        let elo = sorted[i].elo;
        let change = String(parseInt(sorted[i].elo) - parseInt(sorted[i].oldelo));
        let changeSign = (change < 0) ? "" : "+";
        let field = {
            "name": sorted[i].rank + ": " + sorted[i].name,
            "value": "elo: " + elo +" (" + changeSign + change + ")\n*updated " + String(Math.floor((d.getTime() - sorted[i].time) / 60000)) + " minutes ago*\n- ",
            "inline": true
        };
        fields.push(field)
    }
    let embed = {
            "embed": {
                "title": "Brawlhalla Aus 1v1 Queue",
                "description": "Displaying players in the top 300 who have played ranked in the last 30 minutes.\n- ",
                // "url": "https://discordapp.com",
                "color": 16743647,
                "timestamp": new Date(),
                "footer": {

                    // "text": "updated"
                },
                "thumbnail": {
                    "url": "https://i.imgur.com/LmdHZUg.png"
                },
                "author": {
                    // "name": "lesmaux",
                    // "url": "https://discordapp.com",
                    // "icon_url": "https://cdn.discordapp.com/avatars/101209482347937792/a_d309df2dcf75c67d9d5777fca7327bf3.png?size=128"
                },
                "fields": fields
            }
        }
    ;
    for(let i = 0, len = discordMessages.length; i < len ; i++){
        if (discordMessages[i] !== undefined) {
            discordMessages[i].edit(embed);
        }
    }
}

function updateRecent(){
    let d = new Date();
    for (let id in data){
        if (d.getTime() - data[id].time < 600000){
            recent[id] = data[id]
        }
    }
    for (let id in recent) {
        if (d.getTime() - data[id].time > 1800000) {
            delete recent[id];
        }
    }
}

function updateList(obj){
    let d = new Date();

    if (obj.brawlhalla_id in data){
        let player = data[obj.brawlhalla_id];
        if (player.elo !== obj.rating){
            player.oldelo = data[obj.brawlhalla_id].elo;
            player.time = d.getTime()
        }

        player.name = obj.name;
        if (player.name.length > 15){
            player.name = player.name.substring(0, 13) + "..."
        }
        player.rank = obj.rank;
        player.elo = obj.rating;

    } else {
        data[obj.brawlhalla_id] = {
            name : obj.name,
            rank : obj.rank,
            oldelo : obj.rating,
            elo : obj.rating,
            time : 0,
        }
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
        //Only allows command from certain roles
        if(!message.member.roles.some(r=>["Admin", "Yumiko"].includes(r.name)) )
        return message.reply("Sorry, you don't have permissions to use this!");

        //Deletes last 100 messages in channel
        const fetched = await message.channel.fetchMessages({limit: 100});
        message.channel.bulkDelete(fetched)
            .catch(error => message.reply(`Couldn't delete messages because of: ${error}`));

        //sends a message and adds it to the edit list.
        lastMsg = await message.channel.send("OK!");
        discordMessages.push(lastMsg);
        updateDiscord()
    }
});

client.login(config.token);