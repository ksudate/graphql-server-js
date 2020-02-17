// apollo-serverモジュールを読み込む
const { ApolloServer } = require(`apollo-server`)

const { GraphQLScalarType } = require(`graphql`)

const typeDefs = ` 
  scalar DateTime
  enum PhotoCategory {
    SELFIE
    PORTRAIT
    ACTION
    LANDSCAPE
    GRAPHIC
  }
  # Photo型を定義します
  type Photo {
    id: ID!
    url: String!
    name: String!
    description: String
    category: PhotoCategory!
    postedBy: User!
    taggedUsers: [User!]!
    created: DateTime!
  }

  # allPhotosはPhotoを返します
  type Query {
    totalPhotos: Int!
    allPhotos(after: DateTime): [Photo!]!
  }

  input PostPhotoInput {
    name: String!
    category: PhotoCategory=PORTRAIT
    description: String
  }

  # ミューテーションによって新たに投稿されたPhotoを返します 
  type Mutation {
    postPhoto(input: PostPhotoInput!): Photo!
  }

  type User {
    githubLogin: ID!
    name: String
    avatar: String
    postedPhotos: [Photo!]!
    inPhotos: [Photo!]!
  }
`

// 写真を格納するための配列を定義する
var _id = 0
var users = [
  { "githubLogin": "mHattrup", "name": "Mike Hattrup" },
  { "githubLogin": "gPlake", "name": "Glen Plake" },
  { "githubLogin": "sSchmidt", "name": "Scot Schmidt" }
]
var photos = [
  {
    "id": "1",
    "name": "Dropping the Heart Chute",
    "description": "the 1",
    "category": "ACTION",
    "githubUser": "gPlake",
    "created": "3-28-1977"
  },
  {
    "id": "2",
    "name": "Enjoying the sunshine",
    "description": "the 2",
    "category": "SELFIE",
    "githubUser": "sSchmidt",
    "created": "1-2-1985"
  },
  {
    "id": "3",
    "name": "Gunbarrel 25",
    "description": "the 3",
    "category": "LANDSCAPE",
    "githubUser": "sSchmidt",
    "created": "2018-04-15T19:09:57.308Z"
  }
]
var tags = [
  { "photoID": "1", "userID": "gPlake" },
  { "photoID": "2", "userID": "sSchmidt" },
  { "photoID": "2", "userID": "mHattrup" },
  { "photoID": "2", "userID": "gPlake" }
]

//const serialize = VALue => new Date(value).toISOString()

//const parseValue = value => new Date(value)

//const parseLiteral = ast => ast.value

const resolvers = {
  Query: {
    // 写真を格納した配列の長さを返す
    totalPhotos: () => photos.length,
    allPhotos: () => photos
  },

  Mutation: {
    postPhoto(parent, args) {
      var newPhoto = {
        id: _id++,
        ...args.input
      }
      photos.push(newPhoto)
     return newPhoto
    }
  },

  Photo: {
    url: parent => `http://sample.com/img/${parent.id}.jpg`,
    postedBy: parent => {
      return users.find(u => u.githubLogin === parent.githubUser)
    },
    taggedUsers: parent => tags
    // 対象の写真が関係しているタグの配列を返す
    .filter(tag => tag.photoID === parent.id)
    // タグの配列をユーザーIDの配列に変換する
    .map(tag => tag.userID)
    // ユーザーIDの配列をユーザーオブジェクトの配列に変換する
    .map(userID => users.find(u => u.githubLogin === userID))
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
  })
}

// サーバーのインスタンスを作成
// その際、typeDefs(スキーマ)とリゾルバを引数にとる
const server = new ApolloServer({
  typeDefs,
  resolvers
})

// Webサーバを起動
server
  .listen()
  .then(({url}) => console.log(`GraphQL Service running on ${url}`))
