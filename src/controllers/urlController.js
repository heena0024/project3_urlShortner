const urlModel = require("../models/urlModel")
//uniqueId generator
const shortId = require('shortid')
var validUrl = require('valid-url');

const redis = require("redis");
const {promisify} = require("util");



//Connection setup for redis
const redisClient = redis.createClient(
     14815,
    "redis-14815.c283.us-east-1-4.ec2.cloud.redislabs.com",
    {no_ready_check:true}

);

redisClient.auth("1iKTdtbM1DXY3hyEdF9AfVAefZ0XM6Ss",function(err){
    if(err)throw(err)
});
redisClient.on("connect",async function(){
    console.log("connected to redis....");
})

const SET_ASYNC = promisify(redisClient.SET).bind(redisClient);
const GET_ASYNC = promisify(redisClient.GET).bind(redisClient);



//validation checking function 
const isValid = function (value) {
    if (typeof value === 'undefined' || value === null) return false
    if (typeof value === 'string' && value.trim().length === 0) return false
    return true;
}
const isValidRequestBody = function (requestBody) {
    return Object.keys(requestBody).length > 0
}


//POST /url/shorten

const urlShortner = async function (req, res) {
    try {
        const data = req.body
        if (!isValidRequestBody(data)) {
            return res.status(400).send({ status: false, messege: "Please Provide The Required Field" })
        }
        else {
            var longUrl = req.body.longUrl
            if (!longUrl) {
                return res.status(400).send({ status: false, messege: "Please Provide The LongUrl" })
            }
            if (!isValid(longUrl)) {
                return res.status(400).send({ status: false, messege: "Please Provide The LongUrl" })
            }
            var longUrl = longUrl.trim()

            

            if (!(/(:?^((https|http|HTTP|HTTPS){1}:\/\/)(([w]{3})[\.]{1})?([a-zA-Z0-9]{1,}[\.])[\w]*((\/){1}([\w@?^=%&amp;~+#-_.]+))*)$/.test(longUrl))) {
                return res.status(400).send({ status: false, message: `This is not a valid Url` })

            }

            // if (!validUrl.isUri(longUrl)) {
            //     return res.status(400).send({ status: false, messege: "The Url Is Not A Valid Url Please Provide The correct Url" })
            // }

            //we have to find using long url here

            ////////////////////////////////////////////////////////////////////////////////////////////
            let cachedlinkdata = await GET_ASYNC(`${req.body.longUrl}`)
            if(cachedlinkdata){
              let change = JSON.parse(cachedlinkdata)
              return res.status(200).send({status:true,redisdata:change})
            }
            ////////////////////////////////////////////////////////////////////////////////////////////

            let find = await urlModel.findOne({longUrl:longUrl}).select({createdAt:0,updatedAt:0,__v:0,_id:0})
            if(find){
                await SET_ASYNC(`${req.body.longUrl}`,JSON.stringify(find));
                return res.status(200).send({status:true,messege:"You should be looking for this",mongodata:find})
            }
            else{

            let generate = shortId.generate();
            let uniqueId = generate.toLowerCase();

            //checking if the code already exists
            let used = await urlModel.findOne({ urlCode: uniqueId })
            if (used) {
                return res.status(400).send({ status: false, messege: "It seems You Have To Hit The Api Again" });
            }

            let baseurl = "http://localhost:3000"
            let shortLink = baseurl + `/` + uniqueId;

            //saving data in database
            data["urlCode"] = uniqueId;
            data["shortUrl"] = shortLink;
            let savedData = await urlModel.create(data);
            return res.status(201).send({
                status: true,
                message: "Data saved Successfully",
                data: savedData,
            });
         }
        }
    } catch (error) {
        return res.status(500).send({
            status: false,
            message: "Something went wrong",
            error: error.message

        })
    }
}


//GET /:urlCode

const geturl = async function (req, res) {
    try {
        let urlCode = req.params.urlCode
        if (!isValid(urlCode)) {
            return res.status(400).send({ status: false, messege: "Please Use A Valid Link" })
        } else {
            let cacheddata = await GET_ASYNC(`${req.params.urlCode}`)
            if(cacheddata){
              let changetype = JSON.parse(cacheddata)
              return  res.status(302).redirect(changetype.longUrl);
            }
            let findUrl = await urlModel.findOne({ urlCode: urlCode })
            if (findUrl) {
            await SET_ASYNC(`${req.params.urlCode}`,JSON.stringify(findUrl));
            return res.status(302).redirect(findUrl.longUrl);
                
            }else{
                return res.status(404).send({ status: false, messege: "Cant Find What You Are Looking For" })
            }
        }

    } catch (error) {
        return res.status(500).send({
            status: false,
            message: "Something went wrong",
            error: error.message
        })
    }
}






module.exports.urlShortner = urlShortner
module.exports.geturl = geturl