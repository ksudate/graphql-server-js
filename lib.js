const fetch = require('node-fetch')
require(`dotenv`).config()

const requestGithubToken = credentials => 
  fetch(
    `http://github.com/login/oauth/access_token?client_id=${process.env.CLIENT_ID}&client_secret=${process.env.CLIENT_SECRET}&code=${credentials.code}`,
    {
      method: 'POST',
      body: JSON.stringify(credentials),
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
    }
  ).then(res => res.json())

const requestGithubUserAccount = token => 
  fetch(`https://api.github.com/user?access_token=${token}`)
    .then(res => res.json())

const authorizeWithGithub = async credentials => {
  const { access_token } = await requestGithubToken(credentials)
  const githubUser = await requestGithubUserAccount(access_token)
  return { ...githubUser, access_token }
}

module.exports = { authorizeWithGithub }
