// this is a microservice that will read the db, via the api, and then share on linkedin via the linkedin api
const axios = require("axios");

const dayjs = require("dayjs");
// extend the dayjs library to add a custom format utc
const utc = require("dayjs/plugin/utc");
dayjs.extend(utc);

const FormData = require("form-data");
const API_PORT = "5000";
console.log(process.env.NODE_ENV);

const VISIBILITY = ["PUBLIC", "CONNECTIONS"];

(async () => {
  const baseURL =
    process.env.NODE_ENV === "development"
      ? `http://localhost:${API_PORT}`
      : `https://pigeon-api.onrender.com`;
  console.log("running a task every 5 minutes");
  const usersUrl = `${baseURL}/api/users/linkedin/users`;
  console.log("🚀 ~ file: index.js ~ line 19 ~ usersUrl", usersUrl);

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
  console.log("🚀 ~ file: index.js ~ line 33 ~ users", users);
  //   get all posts for the users
  const usersIds = users.map((user) => user.id);
  //   loop over the users and get the posts for each user
  await usersIds.forEach(async (userId, index, array) => {
    const getPosts = async () => {
      const options = {
        method: "GET",
        url: `${baseURL}/api/posts`,
        params: { userId: userId },
      };
      try {
        const res = await axios.request(options);
        console.log("🚀 ~ file: index.js ~ line 46 ~ getPosts ~ res", res.data);
        return res.data;
      } catch (err) {
        console.log("🚀 ~ file: index.js ~ line 48 ~ getPosts ~ err", err);
      }
    };
    let { posts } = await getPosts();
    console.log(
      "🚀 ~ file: index.js ~ line 51 ~ awaitusersIds.forEach ~ posts",
      posts
    );

    posts.forEach(async (post) => {
      const user = users.find((user) => user.id === post.id);
      const { accessToken, id } = user;
      const { content, _id, date, isPosted, image } = post;

      // check if date is past, using dayjs, if yes, post to linkedin, and then delete from db
      if (!isPosted && dayjs(date).isBefore(dayjs())) {
        const status = await postToLinkedin(content, accessToken, id, image);
        console.log(
          "🚀 ~ file: index.js ~ line 54 ~ posts.forEach ~ status",
          status
        );
        if (status === 201) {
          // update the post from the db with isPosted: true
          const updateUrl = `${baseURL}/api/posts/${_id}`;
          const updatePost = async (url) => {
            try {
              const body = {
                isPosted: true,
                id: id,
                content: content,
                date: date,
                image: image,
              };
              const response = await axios.put(url, body);
              const { data } = response;
              console.log(
                "🚀 ~ file: index.js ~ line 62 ~ deletePost ~ data",
                data
              );
              return data;
            } catch (error) {
              console.log(
                "🚀 ~ file: index.js ~ line 88 ~ updatePost ~ error",
                error
              );
            }
          };
          updatePost(updateUrl);
        }
      }
      console.log(
        "🚀 ~ file: index.js ~ line 113 ~ posts.forEach ~ image",
        image
      );
    });
  });
})();

// function to post to linkedin via the api, this will be called in the cron job, and will post to linkedin, and then delete the post from the db
const postToLinkedin = async (content, accessToken, id, image = null) => {
  let utf8Content = utf8.encode(content);
  console.log("🚀 ~ file: index.js ~ line 118 ~ postToLinkedin ~ image", image);
  const shareUrl = "https://api.linkedin.com/v2/ugcPosts";
  const headers = {
    "X-Restli-Protocol-Version": "2.0.0",
    Authorization: `Bearer ${accessToken}`,
  };
  let shareBody = {};
  if (image) {
    let uploadUrl = "";
    let asset = "";

    // Register your image to be uploaded.
    const registerUploadUrl =
      "https://api.linkedin.com/v2/assets?action=registerUpload";
    const body = {
      registerUploadRequest: {
        recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
        owner: `urn:li:person:${id}`,
        serviceRelationships: [
          {
            relationshipType: "OWNER",
            identifier: "urn:li:userGeneratedContent",
          },
        ],
      },
    };
    try {
      const registerUploadResponse = await axios.post(registerUploadUrl, body, {
        headers,
      });
      const { data } = registerUploadResponse;
      uploadUrl =
        data.value.uploadMechanism[
          "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
        ].uploadUrl;
      console.log(
        "🚀 ~ file: index.js ~ line 149 ~ postToLinkedin ~ uploadUrl",
        uploadUrl
      );

      asset = data.value.asset;
    } catch (error) {
      console.log(
        "🚀 ~ file: index.js ~ line 140 ~ postToLinkedin ~ error",
        error
      );
    }

    // Upload your image to LinkedIn.
    try {
      // const imageBuffer = Buffer.from(image, "base64");
      // create image binary from image url
      const imageBuffer = await axios.get(image, {
        responseType: "arraybuffer",
      });
      console.log(
        "🚀 ~ file: index.js ~ line 168 ~ postToLinkedin ~ imageBuffer",
        imageBuffer
      );

      const formData = new FormData();
      formData.append("fileupload", imageBuffer.data);
      const uploadResponse = await axios.put(uploadUrl, formData, {
        ...headers,
        ...formData.getHeaders(),
      });
      const { data } = uploadResponse;
      console.log(
        "🚀 ~ file: index.js ~ line 136 ~ postToLinkedin ~ data",
        data
      );
    } catch (error) {
      console.log(
        "🚀 ~ file: index.js ~ line 172 ~ postToLinkedin ~ error",
        error
      );
    }
    // Create the image share.
    shareBody = {
      author: `urn:li:person:${id}`,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: {
            text: utf8Content,
          },
          shareMediaCategory: "IMAGE",
          media: [
            {
              status: "READY",
              description: {
                text: "Center stage!",
              },
              media: asset,
              title: {
                text: "LinkedIn Talent Connect 2021",
              },
            },
          ],
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
      },
    };
  } else {
    shareBody = {
      author: `urn:li:person:${id}`,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: {
            text: utf8Content,
          },
          shareMediaCategory: "NONE",
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
      },
    };
  }

  try {
    const response = await axios.post(shareUrl, shareBody, {
      headers: headers,
    });
    console.log(response);
    return response.status;
  } catch (error) {
    console.log(
      "🚀 ~ file: index.js ~ line 220 ~ postToLinkedin ~ error",
      error
    );
    return error;
  }
};
