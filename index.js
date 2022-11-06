// this is a microservice that will read the db, via the api, and then share on linkedin via the linkedin api
const cron = require("node-cron");
const axios = require("axios");
const VISIBILITY = ["PUBLIC", "CONNECTIONS"];
// schedule cron to run every minute
cron.schedule("* * * * * ", async () => {
  console.log("running a task every minute");
  const usersUrl = "http://localhost:5000/api/users/linkedin/users";

  // get the data from the api async/await
  const getData = async (url) => {
    try {
      const response = await axios.get(url);
      const { data } = response;
      //   console.log(data);
      return data;
    } catch (error) {
      console.log(error);
    }
  };
  let users = await getData(usersUrl);
  //   get all posts for the users
  const postsUrl = "http://localhost:5000/api/posts";
  const getPosts = async (url) => {
    try {
      const response = await axios.get(url);
      const { data } = response;
      //   console.log(data);
      return data;
    } catch (error) {
      console.log(error);
    }
  };
  let { posts } = await getPosts(postsUrl);
  //   loop through the posts, find the id in the users array, and then post to linkedin
  posts.forEach(async (post) => {
    const user = users.find((user) => user.id === post.id);
    const { accessToken, id } = user;
    const { content, _id } = post;
    // TODO: add image later

    const status = await postToLinkedin(content, accessToken, id);
    console.log(
      "🚀 ~ file: index.js ~ line 54 ~ posts.forEach ~ status",
      status
    );
    if (status === 200) {
      // delete the post from the db
      const deleteUrl = `http://localhost:5000/api/posts/${_id}`;
      const deletePost = async (url) => {
        try {
          const response = await axios.delete(url);
          const { data } = response;
          console.log(
            "🚀 ~ file: index.js ~ line 62 ~ deletePost ~ data",
            data
          );
          return data;
        } catch (error) {
          console.log(error);
        }
      };
      deletePost(deleteUrl);
    }
  });
});

// function to post to linkedin via the api, this will be called in the cron job, and will post to linkedin, and then delete the post from the db
const postToLinkedin = async (post, accessToken, id) => {
  const shareUrl = "https://api.linkedin.com/v2/ugcPosts";
  const headers = {
    "X-Restli-Protocol-Version": "2.0.0",
    Authorization: `Bearer ${accessToken}`,
  };
  const body = {
    author: `urn:li:person:8675309${id}`,
    lifecycleState: "PUBLISHED",
    specificContent: {
      shareCommentary: post.content,
      shareMediaCategory: VISIBILITY[1],
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PRIVATE",
    },
  };

  try {
    const response = await axios.post(shareUrl, body, {
      headers: headers,
    });
    console.log(response);
    return response.status;
  } catch (error) {
    console.log(error);
    return error;
  }
};
