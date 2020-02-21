const { authorizeWithGithub } = require('./lib')
const { ApolloServer } = require(`apollo-server-express`)
const express = require(`express`)
const expressPlayground = require(`graphql-playground-middleware-express`).default
const { readFileSync } = require(`fs`)
const { GraphQLScalarType } = require(`graphql`)
const fetch = require('node-fetch')
const { MongoClient } = require(`mongodb`)
require(`dotenv`).config()
const typeDefs = readFileSync(`./typeDefs.graphql`, `UTF-8`)

const resolvers = {
  Query: {
    me: (parent, args, { currentUser}) => currentUser,
    totalPhotos: (parent, args, { db }) => 
      db.collection(`photos`)
      .estimatedDocumentCount(),
    allPhotos: (parent, args, { db }) =>
      db.collection(`photos`)
      .find()
      .toArray(),
    totalUsers: (parent, args, { db }) =>
      db.collection(`users`)
      .estimatedDocumentCount(),
    totalUsers: (parent, args, { db }) =>
      db.collection(`users`)
      .find()
      .toArray()
  },

  Mutation: {
    async postPhoto(parent, args, { db, currentUser }) {
    if (!currentUser) {
        throw new Error('only an authorized user can post a photo')
      }

      const newPhoto = {
        ...args.input,
        userID: currentUser.githubLogin,
        created: new Date()
      }
      
      const { insertedIds } = await db.collection('photos').insert(newPhoto)
      newPhoto.id = insertedIds[0]

      return newPhoto
    },

    async githubAuth(parent, { code }, { db }) {
      let {
        message,
        access_token,
        avatar_url,
        login,
        name
      } = await authorizeWithGithub({
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        code
      })

      if (message) {
        throw new Error(message)
      }
    
      let latestUserInfo = {
        name,
        githubLogin: login,
        githubToken: access_token,
        avatar: avatar_url
      }
      console.log(latestUserInfo)
      console.log(db)
      const { ops:[user] } = await db
        .collection('users')
        .replaceOne({ githubLogin: login }, latestUserInfo, { upsert: true })

      return { user, token: access_token }
    },

    addFakeUsers: async (root, {count}, {db}) => {
      var randomUserApi = `https://randomuser.me/api/?results=${count}`

      var { results } = await fetch(randomUserApi)
        .then(res => res.json())

      var users = results.map(r => ({
        githubLogin: r.login.username,
        name: `${r.name.first} ${r.name.last}`,
        avatar: r.picture.thumbnail,
        githubToken: r.login.sha1
      }))

      await db.collection('users').insert(users)

      return users
    },
  
    async fakeUserAuth (parent, { githubLogin }, { db }) {
    
      var user = await db.collection('users').findOne({ githubLogin })

      if (!user) {
        throw new Error(`cannot find user with githublogin ${githubLogin}`)
      }

      return {
        token: user.githubToken,
        user
      }
    }
  },

  Photo: {
    id: parent => parent.id | parent._id,
    url: parent => `http://sample.com/img/${parent._id}.jpg`,
    postedBy: (parent, args, { db }) =>
      db.collection('users').findOne({ githubLogin: parent.userID })
  },
  User: {
    postedPhotos: parent => {
      return photos.filter(p => p.githubUser === parent.githubLogin)
    },
    inPhotos: parent => tags
    // 対処のユーザーが関係しているタグの配列を返す
    .filter(tag => tag.userID === parent.id)
    // タグの配列を写真IDの配列に変換する
    .map(tag => tag.photoID)
    // 写真IDの配列を写真オブジェクトの配列に変換する
    .map(photoID => photos.find(p => p.id === photoID))
  },

  DateTime: new GraphQLScalarType({
    name: `DateTime`,
    description: `A valid time value`,
    parseValue: value => new Date(value),
    serialize: value => new Date(value).toISOString(),
    parseLiteral: ast => ast.value
  }),
  
}

async function start() {
  const app = express()
  const MONGO_DB = process.env.DB_HOST
  let db
  try {
    const client = await MongoClient.connect(MONGO_DB, { useNewUrlParser: true })
    db = client.db('test') 
    console.log(db)
  } catch (error) {
    console.log(`
    
      Mongo DB Host not found!
      please add DB_HOST environment variable to .env file
      exiting...
       
    `)
    process.exit(1)
  }

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: async ({ req }) => {
      const githubToken = req.headers.authorization
      const currentUser = await db.collection('users').findOne({ githubToken })
      return { db, currentUser}
    }
  })
  server.applyMiddleware({ app })
  app.get(`/`, (req, res) => res.end(`Welcome to the PhotoShare API`))
  app.get(`/playground`,expressPlayground({ endpoint: `/graphql`}))

  app.listen({ port: 4000 }, () =>
    console.log(`GraphQL Server running @ http://localhost:4000${server.graphqlPath}`)
  )
}

start()

