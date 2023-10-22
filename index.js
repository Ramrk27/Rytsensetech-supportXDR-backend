const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const fileUpload = require("express-fileupload");
const con = require("./db/config");
const sgMail = require("@sendgrid/mail");
const Jwt = require("jsonwebtoken");
const jwtkey = process.env.JWT_KEY;
const app = express();
const dotenv = require("dotenv");
dotenv.config();

app.use(express.json());
app.use(fileUpload());
app.use(cors());

// Configure SendGrid with your API key
const sendgridAPIKey =
  "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";
sgMail.setApiKey(sendgridAPIKey);

app.post("/signup", (req, resp) => {
  const data = req.body;
  con.query(
    `SELECT id, datetime, date, user_role, name, email, phone, city, state, otp, status, profile_picture FROM users WHERE email = '${data.email}'`,
    function (err, result) {
      if (err) {
        throw err;
      }
      if (result.length > 0) {
        resp.status(400);
        console.log({ error: "Email is already added" });
        resp.send({ error: "Email is already added" });
      } else {
        bcrypt.hash(data.password, 10, function (err, hash) {
          if (err) {
            console.error(err);
          } else {
            console.log("Hashed Password:", hash);
            // Store the 'hash' in your database for the user
            // con.query("INSERT INTO users SET ?", data, (error, results, fields) => {

            con.query(
              "INSERT INTO users ( name, email, password) VALUES (?,?,?)",
              [data.name, data.email, hash],
              (error, results, fields) => {
                if (error) {
                  throw error;
                } else {
                  con.query(
                    `SELECT id, datetime, date, user_role, name, email, phone, city, state, otp, status, profile_picture FROM users WHERE email = '${data.email}'`,
                    function (err, result) {
                      if (err) {
                        throw err;
                      } else {
                        let sql2 =
                          "INSERT INTO web_popup (user_id, status) VALUES (?,?)";
                        con.query(
                          sql2,
                          [result[0].id, "checked"],
                          function (error2, result2) {
                            if (error2) throw error2;

                            // Compose the email
                            const msg = {
                              to: data.email,
                              from: "noreply@supportxdr.com",
                              subject: "Welcome to SupportXDR!",
                              // text: `This is your OTP for Password Reset: ${rand_digit}`,
                              html: `Dear ${data.name},<br><br>
                        Thank you for signing up for SupportXDR. We are thrilled to have you on board. Your account has been successfully created, and you can now enjoy all the benefits and features SupportXDR offers.<br><br>
                        Best regards,<br>
                        SupportXDR
                        `,
                            };

                            // Send the email using SendGrid
                            sgMail
                              .send(msg)
                              .then(() => {
                                Jwt.sign({ result }, jwtkey, (err, token) => {
                                  if (err) {
                                    resp.status(400);
                                    console.log({
                                      error:
                                        "Something went wrong. Please try again after some time.",
                                    });
                                    resp.send({
                                      error:
                                        "Something went wrong. Please try again after some time.",
                                    });
                                  }
                                  resp.status(200);
                                  resp.send({ result, auth: token });
                                });
                              })
                              .catch((error) => {
                                console.error(error);
                                resp.status(500).json({ success: false });
                              });
                          }
                        );
                      }
                    }
                  );
                }
              }
            );
          }
        });
      }
    }
  );
});

app.post("/login", (req, resp) => {
  const data = req.body;
  if (data.email && data.password) {
    con.query(
      `SELECT id, datetime, date, user_role, name, email, phone, city, state, otp, status, profile_picture, password FROM users WHERE email = '${data.email}'`,
      function (err, result) {
        if (err) {
          throw err;
        }
        if (result.length > 0) {
          const hashedPassword = result[0].password;
          const enteredPassword = data.password;

          bcrypt.compare(
            enteredPassword,
            hashedPassword,
            function (err, isMatch) {
              if (err) {
                resp.status(500).json({ success: false });
              } else if (!isMatch) {
                resp.status(400).json({ error: "Invalid Credentials" });
              } else {
                var status = result[0].status;
                if (status == "disabled") {
                  resp.status(400).json({
                    error: "Unable to login: Your account has been disabled.",
                  });
                } else {
                  Jwt.sign({ result }, jwtkey, (err, token) => {
                    if (err) {
                      resp.status(400).json({
                        error:
                          "Something went wrong. Please try again after some time.",
                      });
                    }
                    resp.status(200).json({ result, auth: token });
                  });
                }
              }
            }
          );
        } else {
          resp.status(400).json({ error: "Invalid Credentials" });
        }
      }
    );
  }
});

app.post("/links", verifyToken, (req, resp) => {
  const user_id = req.user.id; // Access the user_id from the decoded user object
  console.log("user_id", user_id);
  const data = req.body;
  console.log(data.logo, "logog consoleee");
  console.log(data.others, "othersssss");

  if (user_id != data.user_id) {
    resp
      .status(401)
      .send({ result: "Unauthorized. User ID in the token does not match." });
  } else {
    if (data.website) {
      con.query(
        `SELECT * FROM links WHERE user_id = '${data.user_id}' AND website = '${data.website}'`,
        function (err, result) {
          if (err) {
            throw err;
          }
          if (result.length > 0) {
            // The website URL already exists, update the existing record
            var existingRecord = result[0];

            // Update Knowledgebase field
            if (data.Knowledgebase) {
              let newKnowledgebase = data.Knowledgebase.split(",");
              let existingKnowledgebase = existingRecord.Knowledgebase
                ? existingRecord.Knowledgebase.split(",")
                : [];

              newKnowledgebase.forEach((item) => {
                if (!existingKnowledgebase.includes(item.trim())) {
                  existingKnowledgebase.push(item.trim());
                }
              });

              existingRecord.Knowledgebase = existingKnowledgebase.join(",");
            }
            // Update Knowledgebase field
            if (data.others) {
              let newothers = data.others.split(",");
              let existingothers = existingRecord.others
                ? existingRecord.others.split(",")
                : [];

              newothers.forEach((item) => {
                if (!existingothers.includes(item.trim())) {
                  existingothers.push(item.trim());
                }
              });

              existingRecord.others = existingothers.join(",");
            }

            // Update support field
            if (data.support) {
              let newSupport = data.support.split(",");
              let existingSupport = existingRecord.support
                ? existingRecord.support.split(",")
                : [];

              newSupport.forEach((item) => {
                if (!existingSupport.includes(item.trim())) {
                  existingSupport.push(item.trim());
                }
              });

              existingRecord.support = existingSupport.join(",");
            }

            // Update chat field
            if (data.chat) {
              let newChat = data.chat.split(",");
              let existingChat = existingRecord.chat
                ? existingRecord.chat.split(",")
                : [];

              newChat.forEach((item) => {
                if (!existingChat.includes(item.trim())) {
                  existingChat.push(item.trim());
                }
              });

              existingRecord.chat = existingChat.join(",");
            }

            let sql =
              "UPDATE links SET Knowledgebase = ?, support = ?, chat = ?, others = ? WHERE id = ?";
            con.query(
              sql,
              [
                existingRecord.Knowledgebase,
                existingRecord.support,
                existingRecord.chat,
                existingRecord.others,
                existingRecord.id,
              ],
              function (error, result, rows, fields) {
                if (error) {
                  throw error;
                } else {
                  resp.status(200);
                  console.log(result);
                  resp.send(result);
                }
              }
            );
          } else {
            // The website URL does not exist, create a new record
            let sql2 =
              "INSERT INTO links (user_id, website, websitename, logo, Knowledgebase, support, chat, others) VALUES (?,?,?,?,?,?,?,?)";
            con.query(
              sql2,
              [
                data.user_id,
                data.website,
                data.websitename,
                data.logo,
                data.Knowledgebase,
                data.support,
                data.chat,
                data.others,
              ],
              function (error2, result2) {
                if (error2) throw error2;
                resp.status(200);
                console.log(result2);
                resp.send(result2);
              }
            );
          }
        }
      );
    }
  }
});

//bookmark

app.post("/bookmarkWebUrl", verifyToken, (req, resp) => {
  const user_id = req.user.id; // Access the user_id from the decoded user object
  console.log("user_id", user_id);
  const data = req.body;
  console.log(data.logo, "logog consoleee");
  if (user_id != data.user_id) {
    resp
      .status(401)
      .send({ result: "Unauthorized. User ID in the token does not match." });
  } else {
    if (data.website) {
      con.query(
        `SELECT * FROM links WHERE user_id = '${data.user_id}' AND website = '${data.website}'`,
        function (err, result) {
          if (err) {
            throw err;
          }
          if (result.length > 0) {
            // The website URL already exists, update the existing record
            var existingRecord = result[0];

            // Update others field bookmark items
            if (data.currentWebUrl) {
              let newothers = data.currentWebUrl.split(",");
              let existingOthers = existingRecord.others
                ? existingRecord.others.split(",")
                : [];

              newothers.forEach((item) => {
                if (!existingOthers.includes(item.trim())) {
                  existingOthers.push(item.trim());
                }
              });

              existingRecord.others = existingOthers.join(",");
            }

            let sql = "UPDATE links SET others = ? WHERE id = ?";
            con.query(
              sql,
              [existingRecord.others, existingRecord.id],
              function (error, result, rows, fields) {
                if (error) {
                  throw error;
                } else {
                  resp.status(200);
                  console.log(result);
                  resp.send(result);
                }
              }
            );
          } else {
            // The website URL does not exist, create a new record
            let sql2 =
              "INSERT INTO links (user_id, website, websitename, logo, others) VALUES (?,?,?,?,?)";
            con.query(
              sql2,
              [
                data.user_id,
                data.website,
                data.websitename,
                data.logo,
                data.currentWebUrl,
              ],
              function (error2, result2) {
                if (error2) throw error2;
                resp.status(200);
                console.log(result2);
                resp.send(result2);
              }
            );
          }
        }
      );
    }
  }
});

app.post("/addnewlink", verifyToken, (req, resp) => {
  const data = req.body;

  const user_id = req.user.id; // Access the user_id from the decoded user object
  console.log("user_id", user_id);
  if (user_id != data.user_id) {
    resp
      .status(401)
      .send({ result: "Unauthorized. User ID in the token does not match." });
  } else {
    if (data.companyname) {
      if (data.category == "others") {
        var links = "others";
        var note = "note_others";
      } else if (data.category == "chat") {
        var links = "chat";
        var note = "note_chat";
      } else if (data.category == "support") {
        var links = "support";
        var note = "note_support";
      } else {
        var links = "Knowledgebase";
        var note = "note_Knowledgebase";
      }
      con.query(
        `SELECT * FROM links WHERE user_id = '${data.user_id}' AND websitename = '${data.companyname}'`,
        function (err, result) {
          if (err) {
            throw err;
          }
          if (result.length > 0) {
            if (links == "Knowledgebase") {
              var Knowledgebase = result[0].Knowledgebase;
              var final = data.links;
              if (Knowledgebase && Knowledgebase != null) {
                let position = Knowledgebase.search(final);
                if (position === -1) {
                  var final = `${Knowledgebase},${data.links}`;
                } else {
                  var final = `${Knowledgebase}`;
                }
              }
            }
            if (links == "support") {
              var support = result[0].support;
              var final = data.links;
              if (support && support != null) {
                let position = support.search(final);
                if (position === -1) {
                  var final = `${support},${data.links}`;
                } else {
                  var final = `${support}`;
                }
              }
            }
            if (links == "chat") {
              var chat = result[0].chat;
              var final = data.links;
              if (chat && chat != null) {
                let position = chat.search(final);
                if (position === -1) {
                  var final = `${chat},${data.links}`;
                } else {
                  var final = `${chat}`;
                }
              }
            }
            if (links == "others") {
              var others = result[0].others;
              var final = data.links;
              if (others && others != null) {
                let position = others.search(final);
                if (position === -1) {
                  var final = `${others},${data.links}`;
                } else {
                  var final = `${others}`;
                }
              }
            }
            let sql =
              "UPDATE links SET " + links + " =?, " + note + " =? WHERE id = ?";
            con.query(
              sql,
              [final, data.note, result[0].id],
              function (error, result, rows, fields) {
                if (error) {
                  throw error;
                } else {
                  resp.status(200);
                  console.log(result);
                  resp.send(result);
                }
              }
            );
          } else {
            let sql2 =
              "INSERT INTO links (user_id, websitename, " +
              links +
              ", " +
              note +
              ") VALUES (?,?,?,?)";
            con.query(
              sql2,
              [data.user_id, data.companyname, data.links, data.note],
              function (error2, result2) {
                if (error2) throw error2;
                resp.status(200);
                console.log(result2);
                resp.send(result2);
              }
            );
          }
        }
      );
    }
  }
});

app.post("/getlinks", verifyToken, (req, resp) => {
  const data = req.body;
  const user_id = req.user.id; // Access the user_id from the decoded user object
  console.log("user_id", user_id);
  if (user_id != data.user_id) {
    resp
      .status(401)
      .send({ result: "Unauthorized. User ID in the token does not match." });
  } else {
    con.query(
      `SELECT * FROM links WHERE user_id = '${data.user_id}'`,
      function (err, result) {
        if (err) {
          throw err;
        }
        if (result.length > 0) {
          resp.status(200);

          resp.send(result);
        } else {
          resp.status(400);
          console.log("Invalid User id");
          resp.send("Invalid User id");
        }
      }
    );
  }
});

app.post("/dellinks", verifyToken, (req, resp) => {
  const data = req.body;
  const user_id = req.user.id; // Access the user_id from the decoded user object
  console.log("user_id", user_id);
  if (user_id != data.user_id) {
    resp
      .status(401)
      .send({ result: "Unauthorized. User ID in the token does not match." });
  } else {
    con.query(
      `DELETE FROM links WHERE id = '${data.id}'`,
      function (err, result) {
        if (err) {
          throw err;
        } else {
          resp.status(200);
          console.log(result);
          resp.send(result);
        }
      }
    );
  }
});

//deleting single url
app.post("/dellsingleurl", verifyToken, (req, resp) => {
  const data = req.body;
  const user_id = req.user.id;
  const urlToDelete = data.urltext;
  const columnUpdate = data.columnUpdate;
  if (user_id != data.user_id) {
    resp
      .status(401)
      .send({ result: "Unauthorized. User ID in the token does not match." });
  } else {
    const website = data.urlwebsitename;
    if (columnUpdate === "knowledge") {
      con.query(
        // Retrieve the current Knowledgebase string
        "SELECT Knowledgebase FROM links WHERE user_id = ? AND websitename = ?",
        [user_id, website],
        function (err, result) {
          if (err) {
            throw err;
          } else if (result.length === 1) {
            //result comes in array , here we are fetching the data from knowledge coulumns
            const currentKnowledgebase = result[0].Knowledgebase;

            // Split the Knowledgebase string into an array of URLs
            const urlArray = currentKnowledgebase.split(",");
            // Remove the URL to delete from the array
            const indexToDelete = urlArray.indexOf(urlToDelete);

            if (indexToDelete !== -1) {
              urlArray.splice(indexToDelete, 1);
            }

            // Join the remaining URLs back into a comma-separated string
            const updatedKnowledgebase = urlArray.join(",");

            // Update the Knowledgebase column with the new string
            con.query(
              "UPDATE links SET Knowledgebase = ? WHERE user_id = ? AND websitename = ?",
              [updatedKnowledgebase, user_id, website],
              function (err, updateResult) {
                if (err) {
                  throw err;
                } else {
                  console.log(updateResult, "resultts");
                  resp
                    .status(200)
                    .send({ result: "URL deleted successfully." });
                }
              }
            );
          } else {
            resp.status(404).send({ result: "User or website not found." });
          }
        }
      );
    } else if (columnUpdate === "chat") {
      con.query(
        // Retrieve the current Knowledgebase string
        "SELECT chat FROM links WHERE user_id = ? AND websitename = ?",
        [user_id, website],
        function (err, result) {
          if (err) {
            throw err;
          } else if (result.length === 1) {
            const currentchat = result[0].chat;
            // Split the Knowledgebase string into an array of URLs
            const urlArray = currentchat.split(",");
            // Remove the URL to delete from the array
            const indexToDelete = urlArray.indexOf(urlToDelete);

            if (indexToDelete !== -1) {
              urlArray.splice(indexToDelete, 1);
            }

            // Join the remaining URLs back into a comma-separated string
            const updatedChat = urlArray.join(",");

            // Update the Knowledgebase column with the new string
            con.query(
              "UPDATE links SET chat = ? WHERE user_id = ? AND websitename = ?",
              [updatedChat, user_id, website],
              function (err, updateResult) {
                if (err) {
                  throw err;
                } else {
                  console.log(updateResult, "resultts");
                  resp
                    .status(200)
                    .send({ result: "URL deleted successfully." });
                }
              }
            );
          } else {
            resp.status(404).send({ result: "User or website not found." });
          }
        }
      );
    } else if (columnUpdate === "support") {
      con.query(
        // Retrieve the current Knowledgebase string
        "SELECT support FROM links WHERE user_id = ? AND websitename = ?",
        [user_id, website],
        function (err, result) {
          if (err) {
            throw err;
          } else if (result.length === 1) {
            const currentsupport = result[0].support;

            // Split the Knowledgebase string into an array of URLs
            const urlArray = currentsupport.split(",");

            // Remove the URL to delete from the array
            const indexToDelete = urlArray.indexOf(urlToDelete);
            console.log(indexToDelete, "index urll");

            if (indexToDelete !== -1) {
              urlArray.splice(indexToDelete, 1);
            }

            // Join the remaining URLs back into a comma-separated string
            const updatedsupport = urlArray.join(",");
            console.log(updatedsupport, "is itt");

            // Update the Knowledgebase column with the new string
            con.query(
              "UPDATE links SET support = ? WHERE user_id = ? AND websitename = ?",
              [updatedsupport, user_id, website],
              function (err, updateResult) {
                if (err) {
                  throw err;
                } else {
                  console.log(updateResult, "resultts");
                  resp
                    .status(200)
                    .send({ result: "URL deleted successfully." });
                }
              }
            );
          } else {
            resp.status(404).send({ result: "User or website not found." });
          }
        }
      );
    } else if (columnUpdate === "others") {
      con.query(
        // Retrieve the current Knowledgebase string
        "SELECT others FROM links WHERE user_id = ? AND websitename = ?",
        [user_id, website],
        function (err, result) {
          if (err) {
            throw err;
          } else if (result.length === 1) {
            const currentothers = result[0].others;

            // Split the Knowledgebase string into an array of URLs
            const urlArray = currentothers.split(",");

            // Remove the URL to delete from the array
            const indexToDelete = urlArray.indexOf(urlToDelete);
            console.log(indexToDelete, "index urll");

            if (indexToDelete !== -1) {
              urlArray.splice(indexToDelete, 1);
            }

            // Join the remaining URLs back into a comma-separated string
            const updatedothers = urlArray.join(",");
            console.log(updatedothers, "is itt");

            // Update the Knowledgebase column with the new string
            con.query(
              "UPDATE links SET others = ? WHERE user_id = ? AND websitename = ?",
              [updatedothers, user_id, website],
              function (err, updateResult) {
                if (err) {
                  throw err;
                } else {
                  console.log(updateResult, "resultts");
                  resp
                    .status(200)
                    .send({ result: "URL deleted successfully." });
                }
              }
            );
          } else {
            resp.status(404).send({ result: "User or website not found." });
          }
        }
      );
    }
  }
});

//editAllLinks
app.post("/editAllLinks", verifyToken, (req, resp) => {
  const data = req.body;
  const user_id = req.user.id;
  const updateItem = data.updateItem;
  const websiteId = data.id; // Assuming you have a unique identifier for the website to update1
  const userId = data.user_id;

  if (user_id != data.user_id) {
    resp
      .status(401)
      .send({ result: "Unauthorized. User ID in the token does not match." });
  } else {
    // Execute the UPDATE query with placeholders
    const sql = "UPDATE links SET websitename = ? WHERE id = ? AND user_id =?";
    con.query(
      sql,
      [updateItem, websiteId, userId],
      function (err, updateResult) {
        if (err) {
          console.error("Error updating website:", err);
          console.log(updateResult, "latest");
          resp.status(500).send({ result: "Internal server error" });
        } else {
          console.log("Website updated successfully.");
          resp.status(200).send({ result: "Website updated successfully" });
        }
      }
    );
  }
});

//dark mode
app.post("/setDarkMode", verifyToken, (req, resp) => {
  const data = req.body;
  const user_id = req.user.id;
  const darkMode = data.darkMode; // Assuming you have a unique identifier for the website to update1
  const userId = data.user_id;

  if (user_id != data.user_id) {
    resp
      .status(401)
      .send({ result: "Unauthorized. User ID in the token does not match." });
  } else {
    // Execute the UPDATE query with placeholders
    const sql = "UPDATE users SET dark_mode = ? WHERE  id =?";
    con.query(sql, [darkMode, userId], function (err, updateResult) {
      if (err) {
        console.error("Error updating website:", err);
        console.log(updateResult, "latest");
        resp.status(500).send({ result: "Internal server error" });
      } else {
        console.log("Website updated successfully.");
        resp.status(200).send({ result: "Website updated successfully" });
      }
    });
  }
});
//edit Logo
app.post("/editLogoWeb", verifyToken, async (req, resp) => {
  // const data = req.body;
  // const user_id = req.user.id;
  // const currUserId = data.user_id;
  // const websiteId = data.id
  console.log("gggggg");

  const formData = req.body.formData;

  if (user_id != data.user_id) {
    resp
      .status(401)
      .send({ result: "Unauthorized. User ID in the token does not match." });
  } else {
    // const sql = `
    //   UPDATE links
    //   SET logo = ?
    //   WHERE id = ? AND user_id = ?
    // `;
    // con.query(
    //   sql,
    //   [imageDestination, websiteId, user_id],
    //   function (error, result, rows, fields) {
    //     if (error) {
    //       throw error;
    //     } else {
    //       resp.status(200);
    //       console.log(result);
    //       resp.send(result);
    //     }
    //   }
    // );
  }
});

// Serve static files from the 'images' directory

app.post("/editCategory", verifyToken, (req, resp) => {
  const data = req.body;
  const user_id = req.user.id;
  const urlToEdit = data.urlToEdit;
  const websiteId = data.id;
  const userId = data.user_id;
  const insertcolumn = data.insertcolumn;
  const deletecolumn = data.deletecolumn;

  if (user_id != data.user_id) {
    resp
      .status(401)
      .send({ result: "Unauthorized. User ID in the token does not match." });
  } else {
    if (deletecolumn === "knowledge") {
      // Delete the URL from the "Knowledgebase" column
      deleteUrlFromColumn(
        "Knowledgebase",
        user_id,
        websiteId,
        urlToEdit,
        () => {
          // After deleting, insert the URL into the specified column
          insertUrlIntoColumn(
            insertcolumn,
            user_id,
            websiteId,
            urlToEdit,
            (insertResult) => {
              // Send the response based on the insert result
              resp
                .status(insertResult.status)
                .send({ result: insertResult.message });
            }
          );
        }
      );
    } else if (deletecolumn === "chat") {
      // Delete the URL from the "Chat" column
      deleteUrlFromColumn("Chat", user_id, websiteId, urlToEdit, () => {
        // After deleting, insert the URL into the specified column
        insertUrlIntoColumn(
          insertcolumn,
          user_id,
          websiteId,
          urlToEdit,
          (insertResult) => {
            // Send the response based on the insert result
            resp
              .status(insertResult.status)
              .send({ result: insertResult.message });
          }
        );
      });
    } else if (deletecolumn === "support") {
      // Delete the URL from the "Support" column
      deleteUrlFromColumn("Support", user_id, websiteId, urlToEdit, () => {
        // After deleting, insert the URL into the specified column
        insertUrlIntoColumn(
          insertcolumn,
          user_id,
          websiteId,
          urlToEdit,
          (insertResult) => {
            // Send the response based on the insert result
            resp
              .status(insertResult.status)
              .send({ result: insertResult.message });
          }
        );
      });
    } else if (deletecolumn === "others") {
      // Delete the URL from the "Others" column
      deleteUrlFromColumn("Others", user_id, websiteId, urlToEdit, () => {
        // After deleting, insert the URL into the specified column
        insertUrlIntoColumn(
          insertcolumn,
          user_id,
          websiteId,
          urlToEdit,
          (insertResult) => {
            // Send the response based on the insert result
            resp
              .status(insertResult.status)
              .send({ result: insertResult.message });
          }
        );
      });
    }
  }
});

// editCategory delete url
// Function to delete a URL from a specified column
function deleteUrlFromColumn(
  columnName,
  user_id,
  websiteId,
  urlToEdit,
  callback
) {
  con.query(
    // Retrieve the current column value
    `SELECT ${columnName} FROM links WHERE user_id = ? AND id = ?`,
    [user_id, websiteId],
    (err, result) => {
      if (err) {
        throw err;
      } else if (result.length === 1) {
        // Result comes in an array; fetch the data from the specified column
        const currentColumn = result[0][columnName];

        // Split the column value into an array of URLs
        const urlArray = currentColumn ? currentColumn.split(",") : [];

        // Remove the URL to delete from the array
        const indexToDelete = urlArray.indexOf(urlToEdit);

        if (indexToDelete !== -1) {
          urlArray.splice(indexToDelete, 1);
        }

        // Join the remaining URLs back into a comma-separated string
        const updatedColumn = urlArray.join(",");

        // Update the specified column with the new string
        con.query(
          `UPDATE links SET ${columnName} = ? WHERE user_id = ? AND id = ?`,
          [updatedColumn, user_id, websiteId],
          (err, updateResult) => {
            if (err) {
              throw err;
            } else {
              console.log(updateResult, "resultts");
              callback();
            }
          }
        );
      } else {
        callback();
      }
    }
  );
}

// editCategory add url
// Function to insert a URL into a specified column
function insertUrlIntoColumn(
  columnName,
  user_id,
  websiteId,
  urlToEdit,
  callback
) {
  con.query(
    // Retrieve the current column value
    `SELECT ${columnName} FROM links WHERE user_id = ? AND id = ?`,
    [user_id, websiteId],
    (err, result) => {
      if (err) {
        throw err;
      } else if (result.length === 1) {
        // Result comes in an array; fetch the data from the specified column
        const currentColumn = result[0][columnName];

        // Split the column value into an array of URLs
        const urlArray = currentColumn ? currentColumn.split(",") : [];

        // Add the user-given URL to the array
        urlArray.push(urlToEdit);

        // Join the URLs back into a comma-separated string
        const updatedColumn = urlArray.join(",");

        // Update the specified column with the new string
        con.query(
          `UPDATE links SET ${columnName} = ? WHERE user_id = ? AND id = ?`,
          [updatedColumn, user_id, websiteId],
          (err, updateResult) => {
            if (err) {
              throw err;
            } else {
              console.log(updateResult, "resultts");
              callback({
                status: 200,
                message: `URL inserted into ${columnName} successfully.`,
              });
            }
          }
        );
      } else {
        callback({
          status: 404,
          message: "User or website not found.",
        });
      }
    }
  );
}

//editwebUrl
app.post("/editWebUrl", verifyToken, (req, resp) => {
  const data = req.body;
  const user_id = req.user.id;

  const currentUrl = data.currentUrl;
  const websiteId = data.id; // Assuming you have a unique identifier for the website to update1
  const newUrl = data.newUrl;
  const updatingColumn = data.updatingColumn;
  console.log(newUrl, "urlll");
  if (user_id != data.user_id) {
    resp
      .status(401)
      .send({ result: "Unauthorized. User ID in the token does not match." });
  } else {
    if (updatingColumn === "knowledge") {
      con.query(
        "SELECT Knowledgebase FROM links WHERE user_id = ? AND id = ?",
        [user_id, websiteId],
        function (err, result) {
          if (err) {
            throw err;
          } else if (result.length === 1) {
            // Result comes in an array, here we are fetching the data from the Knowledgebase column
            const currentKnowledgebase = result[0].Knowledgebase;

            // Split the Knowledgebase string into an array of URLs
            const urlArray = currentKnowledgebase.split(",");

            // Find and replace the URL in the array
            const indexToReplace = urlArray.indexOf(currentUrl);
            if (indexToReplace !== -1) {
              urlArray[indexToReplace] = newUrl;
            }

            // Join the URLs back into a comma-separated string
            const updatedKnowledgebase = urlArray.join(",");

            // Update the Knowledgebase column with the new string
            con.query(
              "UPDATE links SET Knowledgebase = ? WHERE user_id = ? AND id = ?",
              [updatedKnowledgebase, user_id, websiteId],
              function (err, updateResult) {
                if (err) {
                  throw err;
                } else {
                  console.log(updateResult, "resultts");
                  resp
                    .status(200)
                    .send({ result: "URL updated successfully." });
                }
              }
            );
          } else {
            resp.status(404).send({ result: "User or website not found." });
          }
        }
      );
    } else if (updatingColumn === "support") {
      con.query(
        "SELECT support FROM links WHERE user_id = ? AND id = ?",
        [user_id, websiteId],
        function (err, result) {
          if (err) {
            throw err;
          } else if (result.length === 1) {
            // Result comes in an array, here we are fetching the data from the Knowledgebase column
            const currentSupportBase = result[0].support;

            // Split the Knowledgebase string into an array of URLs
            const urlArray = currentSupportBase.split(",");

            // Find and replace the URL in the array
            const indexToReplace = urlArray.indexOf(currentUrl);
            if (indexToReplace !== -1) {
              urlArray[indexToReplace] = newUrl;
            }

            // Join the URLs back into a comma-separated string
            const updatedsupport = urlArray.join(",");

            // Update the Knowledgebase column with the new string
            con.query(
              "UPDATE links SET support = ? WHERE user_id = ? AND id = ?",
              [updatedsupport, user_id, websiteId],
              function (err, updateResult) {
                if (err) {
                  throw err;
                } else {
                  console.log(updateResult, "resultts");
                  resp
                    .status(200)
                    .send({ result: "URL updated successfully." });
                }
              }
            );
          } else {
            resp.status(404).send({ result: "User or website not found." });
          }
        }
      );
    } else if (updatingColumn === "chat") {
      con.query(
        "SELECT chat FROM links WHERE user_id = ? AND id = ?",
        [user_id, websiteId],
        function (err, result) {
          if (err) {
            throw err;
          } else if (result.length === 1) {
            // Result comes in an array, here we are fetching the data from the Knowledgebase column
            const currentChat = result[0].chat;

            // Split the Knowledgebase string into an array of URLs
            const urlArray = currentChat.split(",");

            // Find and replace the URL in the array
            const indexToReplace = urlArray.indexOf(currentUrl);
            if (indexToReplace !== -1) {
              urlArray[indexToReplace] = newUrl;
            }

            // Join the URLs back into a comma-separated string
            const updatedChat = urlArray.join(",");

            // Update the Knowledgebase column with the new string
            con.query(
              "UPDATE links SET chat = ? WHERE user_id = ? AND id = ?",
              [updatedChat, user_id, websiteId],
              function (err, updateResult) {
                if (err) {
                  throw err;
                } else {
                  console.log(updateResult, "resultts");
                  resp
                    .status(200)
                    .send({ result: "URL updated successfully." });
                }
              }
            );
          } else {
            resp.status(404).send({ result: "User or website not found." });
          }
        }
      );
    } else if (updatingColumn === "others") {
      con.query(
        "SELECT others FROM links WHERE user_id = ? AND id = ?",
        [user_id, websiteId],
        function (err, result) {
          if (err) {
            throw err;
          } else if (result.length === 1) {
            // Result comes in an array, here we are fetching the data from the Knowledgebase column
            const currentothers = result[0].others;

            // Split the Knowledgebase string into an array of URLs
            const urlArray = currentothers.split(",");

            // Find and replace the URL in the array
            const indexToReplace = urlArray.indexOf(currentUrl);
            if (indexToReplace !== -1) {
              urlArray[indexToReplace] = newUrl;
            }

            // Join the URLs back into a comma-separated string
            const updatedothers = urlArray.join(",");

            // Update the Knowledgebase column with the new string
            con.query(
              "UPDATE links SET others = ? WHERE user_id = ? AND id = ?",
              [updatedothers, user_id, websiteId],
              function (err, updateResult) {
                if (err) {
                  throw err;
                } else {
                  console.log(updateResult, "resultts");
                  resp
                    .status(200)
                    .send({ result: "URL updated successfully." });
                }
              }
            );
          } else {
            resp.status(404).send({ result: "User or website not found." });
          }
        }
      );
    }
  }
});

app.post("/addnewnote", verifyToken, (req, resp) => {
  const data = req.body;
  const user_id = req.user.id; // Access the user_id from the decoded user object

  const newNote = data.newNote;
  const updatingColumn = data.updatingColumn;
  const websiteId = data.id;

  console.log("user_id from add notes", user_id);
  console.log(updatingColumn, newNote, websiteId, "add new note");

  // Ensure user_id matches the user_id from the token
  if (user_id != data.user_id) {
    resp
      .status(401)
      .send({ result: "Unauthorized. User ID in the token does not match." });
  } else {
    if (updatingColumn === "note-knowledge") {
      const sql = `
        UPDATE links
        SET note_Knowledgebase = ?
        WHERE user_id = ? AND id = ?
      `;
      con.query(sql, [newNote, user_id, websiteId], (error, results) => {
        if (error) {
          // Handle the error
          resp.status(500).send({ result: "Database error" });
        } else {
          // Query executed successfully
          console.log(results);
          resp.status(200).send({ result: "Note updated successfully" });
        }
      });
    } else if (updatingColumn === "note-support") {
      const sql = `
        UPDATE links
        SET note_support = ?
        WHERE user_id = ? AND id = ?
      `;
      con.query(sql, [newNote, user_id, websiteId], (error, results) => {
        if (error) {
          // Handle the error
          resp.status(500).send({ result: "Database error" });
        } else {
          // Query executed successfully
          console.log(results);
          resp.status(200).send({ result: "Note updated successfully" });
        }
      });
    } else if (updatingColumn === "note-chat") {
      const sql = `
        UPDATE links
        SET note_chat = ?
        WHERE user_id = ? AND id = ?
      `;
      con.query(sql, [newNote, user_id, websiteId], (error, results) => {
        if (error) {
          // Handle the error
          resp.status(500).send({ result: "Database error" });
        } else {
          // Query executed successfully
          console.log(results);
          resp.status(200).send({ result: "Note updated successfully" });
        }
      });
    } else if (updatingColumn === "note-others") {
      const sql = `
        UPDATE links
        SET note_others = ?
        WHERE user_id = ? AND id = ?
      `;
      con.query(sql, [newNote, user_id, websiteId], (error, results) => {
        if (error) {
          // Handle the error
          resp.status(500).send({ result: "Database error" });
        } else {
          // Query executed successfully
          console.log(results);
          resp.status(200).send({ result: "Note updated successfully" });
        }
      });
    }
  }
});

app.post("/addHashtag", verifyToken, (req, resp) => {
  const data = req.body;
  const user_id = req.user.id; // Access the user_id from the decoded user object

  console.log("user_id from hashtagggg", user_id);
  console.log(data.website_name, data.id, data.hashTagNew, "websiteet db hash");
  if (user_id != data.user_id) {
    resp
      .status(401)
      .send({ result: "Unauthorized. User ID in the token does not match." });
  } else {
    // Execute the UPDATE query with placeholders
    con.query(
      "UPDATE links SET hashtag = ? WHERE user_id =? AND websitename =?",
      [data.hashTagNew, data.user_id, data.website_name],
      function (err, updateResult) {
        if (err) throw err;

        // Process the UPDATE result here
        console.log(updateResult, "hashtaggg");
        resp.status(200);
        resp.send(updateResult);
      }
    );
  }
});

app.post("/updateuser", verifyToken, (req, resp) => {
  const user_id = req.user.id; // Access the user_id from the decoded user object
  console.log("user_id", user_id);
  const data = req.body;
  if (user_id == "82" || user_id == "95") {
    if (data.profile_picture) {
      if (data.password) {
        let sql =
          "UPDATE users SET name =?, password =?, phone =?, city =?, state =?, profile_picture =? WHERE id = ?";
        con.query(
          sql,
          [
            data.name,
            data.password,
            data.phone,
            data.city,
            data.state,
            data.profile_picture,
            data.user_id,
          ],
          function (error, result, rows, fields) {
            if (error) {
              throw error;
            } else {
              resp.status(200);
              console.log(result);
              resp.send(result);
            }
          }
        );
      } else {
        let sql =
          "UPDATE users SET name =?, phone =?, city =?, state =?, profile_picture =? WHERE id = ?";
        con.query(
          sql,
          [
            data.name,
            data.phone,
            data.city,
            data.state,
            data.profile_picture,
            data.user_id,
          ],
          function (error, result, rows, fields) {
            if (error) {
              throw error;
            } else {
              resp.status(200);
              console.log(result);
              resp.send(result);
            }
          }
        );
      }
    } else {
      if (data.password) {
        let sql =
          "UPDATE users SET name =?, password =?, phone =?, city =?, state =? WHERE id = ?";
        con.query(
          sql,
          [
            data.name,
            data.password,
            data.phone,
            data.city,
            data.state,
            data.user_id,
          ],
          function (error, result, rows, fields) {
            if (error) {
              throw error;
            } else {
              resp.status(200);
              console.log(result);
              resp.send(result);
            }
          }
        );
      } else {
        let sql =
          "UPDATE users SET name =?, phone =?, city =?, state =? WHERE id = ?";
        con.query(
          sql,
          [data.name, data.phone, data.city, data.state, data.user_id],
          function (error, result, rows, fields) {
            if (error) {
              throw error;
            } else {
              resp.status(200);
              console.log(result);
              resp.send(result);
            }
          }
        );
      }
    }
  } else if (user_id != "82" || user_id != "95") {
    if (user_id != data.user_id) {
      resp
        .status(401)
        .send({ result: "Unauthorized. User ID in the token does not match." });
    } else {
      if (data.profile_picture) {
        if (data.password) {
          let sql =
            "UPDATE users SET name =?, password =?, phone =?, city =?, state =?, profile_picture =? WHERE id = ?";
          con.query(
            sql,
            [
              data.name,
              data.password,
              data.phone,
              data.city,
              data.state,
              data.profile_picture,
              data.user_id,
            ],
            function (error, result, rows, fields) {
              if (error) {
                throw error;
              } else {
                resp.status(200);
                console.log(result);
                resp.send(result);
              }
            }
          );
        } else {
          let sql =
            "UPDATE users SET name =?, phone =?, city =?, state =?, profile_picture =? WHERE id = ?";
          con.query(
            sql,
            [
              data.name,
              data.phone,
              data.city,
              data.state,
              data.profile_picture,
              data.user_id,
            ],
            function (error, result, rows, fields) {
              if (error) {
                throw error;
              } else {
                resp.status(200);
                console.log(result);
                resp.send(result);
              }
            }
          );
        }
      } else {
        if (data.password) {
          let sql =
            "UPDATE users SET name =?, password =?, phone =?, city =?, state =? WHERE id = ?";
          con.query(
            sql,
            [
              data.name,
              data.password,
              data.phone,
              data.city,
              data.state,
              data.user_id,
            ],
            function (error, result, rows, fields) {
              if (error) {
                throw error;
              } else {
                resp.status(200);
                console.log(result);
                resp.send(result);
              }
            }
          );
        } else {
          let sql =
            "UPDATE users SET name =?, phone =?, city =?, state =? WHERE id = ?";
          con.query(
            sql,
            [data.name, data.phone, data.city, data.state, data.user_id],
            function (error, result, rows, fields) {
              if (error) {
                throw error;
              } else {
                resp.status(200);
                console.log(result);
                resp.send(result);
              }
            }
          );
        }
      }
    }
  }
});

app.post("/getuser", verifyToken, (req, resp) => {
  const user_id = req.user.id; // Access the user_id from the decoded user object
  console.log("user_id", user_id);
  const data = req.body;
  if (user_id == "82" || user_id == "95") {
    con.query(
      `SELECT id, datetime, date, user_role, name, email, phone, city, state, otp, status, profile_picture, dark_mode  FROM users WHERE id = '${data.id}'`,
      function (err, result) {
        if (err) {
          throw err;
        }
        if (result.length > 0) {
          resp.status(200);
          console.log(result, "neww user details");
          resp.send(result);
        } else {
          resp.status(400);
          console.log("Invalid User id");
          resp.send("Invalid User id");
        }
      }
    );
  } else if (user_id != "82" || user_id != "95") {
    if (user_id != data.id) {
      resp
        .status(401)
        .send({ result: "Unauthorized. User ID in the token does not match." });
    } else {
      con.query(
        `SELECT id, datetime, date, user_role, name, email, phone, city, state, otp, status, profile_picture, dark_mode  FROM users WHERE id = '${data.id}'`,
        function (err, result) {
          if (err) {
            throw err;
          }
          if (result.length > 0) {
            resp.status(200);
            console.log(result, "now user details");
            resp.send(result);
          } else {
            resp.status(400);
            console.log("Invalid User id");
            resp.send("Invalid User id");
          }
        }
      );
    }
  }
});

app.post("/web_popup", verifyToken, (req, resp) => {
  const data = req.body;
  const user_id = req.user.id; // Access the user_id from the decoded user object
  console.log("user_id", user_id);
  if (user_id != data.user_id) {
    resp
      .status(401)
      .send({ result: "Unauthorized. User ID in the token does not match." });
  } else {
    con.query(
      `SELECT * FROM web_popup WHERE user_id = '${data.user_id}'`,
      function (err, result) {
        if (err) {
          throw err;
        }
        if (result.length > 0) {
          let sql = "UPDATE web_popup SET date =?, status =? WHERE user_id = ?";
          con.query(
            sql,
            [data.date, data.status, data.user_id],
            function (error, result, rows, fields) {
              if (error) {
                throw error;
              } else {
                resp.status(200);

                resp.send(result);
              }
            }
          );
        } else {
          let sql2 = "INSERT INTO web_popup (user_id, status) VALUES (?,?)";
          con.query(
            sql2,
            [data.user_id, data.status],
            function (error2, result2) {
              if (error2) throw error2;
              resp.status(200);

              resp.send(result2);
            }
          );
        }
      }
    );
  }
});

app.post("/web_popup_status", verifyToken, (req, resp) => {
  const data = req.body;
  const user_id = req.user.id; // Access the user_id from the decoded user object
  console.log("user_id", user_id);
  if (user_id != data.user_id) {
    resp
      .status(401)
      .send({ result: "Unauthorized. User ID in the token does not match." });
  } else {
    con.query(
      `SELECT * FROM web_popup WHERE user_id = '${data.user_id}'`,
      function (err, result) {
        if (err) {
          throw err;
        }
        if (result.length > 0) {
          resp.status(200);

          resp.send(result);
        } else {
          resp.status(400);
          console.log("Invalid User id");
          resp.send("Invalid User id");
        }
      }
    );
  }
});

app.post("/favourite", verifyToken, (req, resp) => {
  const data = req.body;
  const user_id = req.user.id; // Access the user_id from the decoded user object
  console.log("user_id", user_id);
  if (user_id != data.user_id) {
    resp
      .status(401)
      .send({ result: "Unauthorized. User ID in the token does not match." });
  } else {
    let sql =
      "UPDATE links SET favourite =? WHERE user_id =? AND websitename =?";
    con.query(
      sql,
      [data.favourite, data.user_id, data.websitename],
      function (error, result, rows, fields) {
        if (error) {
          throw error;
        } else {
          resp.status(200);

          resp.send(result);
        }
      }
    );
  }
});

app.post("/checkfavourite", verifyToken, (req, resp) => {
  const data = req.body;
  const user_id = req.user.id; // Access the user_id from the decoded user object
  console.log("user_id", user_id);
  if (user_id != data.user_id) {
    resp
      .status(401)
      .send({ result: "Unauthorized. User ID in the token does not match." });
  } else {
    con.query(
      `SELECT * FROM links WHERE user_id = '${data.user_id}'  AND websitename = '${data.websitename}'`,
      function (err, result) {
        if (err) {
          throw err;
        }
        if (result.length > 0) {
          resp.status(200);

          resp.send(result);
        } else {
          resp.status(400);
          console.log("Not Found");
          resp.send("Not Found");
        }
      }
    );
  }
});

app.post("/recently_used", verifyToken, (req, resp) => {
  const data = req.body;
  const user_id = req.user.id; // Access the user_id from the decoded user object
  console.log("user_id", user_id);
  if (user_id != data.user_id) {
    resp
      .status(401)
      .send({ result: "Unauthorized. User ID in the token does not match." });
  } else {
    let sql =
      "UPDATE links SET date =?, recently_used = ? WHERE user_id =? AND websitename =?";
    con.query(
      sql,
      [data.date, data.recently_used, data.user_id, data.websitename],
      function (error, result, rows, fields) {
        if (error) {
          throw error;
        } else {
          resp.status(200);
          console.log(result);
          resp.send(result);
        }
      }
    );
  }
});

app.post("/note", verifyToken, (req, resp) => {
  const data = req.body;
  const user_id = req.user.id; // Access the user_id from the decoded user object
  console.log("user_id", user_id);
  if (user_id != data.user_id) {
    resp
      .status(401)
      .send({ result: "Unauthorized. User ID in the token does not match." });
  } else {
    let sql = "UPDATE links SET note =? WHERE user_id =? AND websitename =?";
    con.query(
      sql,
      [data.note, data.user_id, data.websitename],
      function (error, result, rows, fields) {
        if (error) {
          throw error;
        } else {
          resp.status(200);
          console.log(result);
          resp.send(result);
        }
      }
    );
  }
});

app.post("/forget-password", (req, resp) => {
  const data = req.body;
  con.query(
    `SELECT * FROM users WHERE email = '${data.email}'`,
    function (err, result) {
      if (err) {
        throw err;
      }
      if (result.length > 0) {
        var rand_digit = Math.floor(100000 + Math.random() * 900000);
        let sql = "UPDATE users SET otp =? WHERE email =?";
        con.query(
          sql,
          [rand_digit, data.email],
          function (error, result, rows, fields) {
            if (error) {
              throw error;
            } else {
              // Compose the email
              const msg = {
                to: data.email,
                from: "noreply@supportxdr.com",
                subject: "Password Reset",
                text: `This is your OTP for Password Reset: ${rand_digit}`,
                html: `This is your OTP for Password Reset: <p>${rand_digit}</p>`,
              };

              // Send the email using SendGrid
              sgMail
                .send(msg)
                .then(() => {
                  resp.status(200);
                  console.log({ success: true });
                  resp.send({ success: true });
                })
                .catch((error) => {
                  console.error(error);
                  resp.status(500).json({ success: false });
                });
            }
          }
        );
      } else {
        resp.status(400);
        console.log({ result: "This email does not exist" });
        resp.send({ result: "This email does not exist" });
      }
    }
  );
});

app.post("/otp", (req, resp) => {
  const data = req.body;
  con.query(
    `SELECT * FROM users WHERE email = '${data.email}' AND otp = '${data.otp}'`,
    function (err, result) {
      if (err) {
        throw err;
      }
      if (result.length > 0) {
        let sql = "UPDATE users SET otp =? WHERE email =?";
        con.query(
          sql,
          ["", data.email],
          function (error, result, rows, fields) {
            if (error) {
              throw error;
            } else {
              resp.status(200);
              console.log({ success: "success" });
              resp.send({ success: "success" });
            }
          }
        );
      } else {
        resp.status(400);
        console.log({ result: "Invalid OTP" });
        resp.send({ result: "Invalid OTP" });
      }
    }
  );
});

app.post("/reset-password", (req, resp) => {
  const data = req.body;
  con.query(
    `SELECT * FROM users WHERE email = '${data.email}'`,
    function (err, result) {
      if (err) {
        throw err;
      }
      if (result.length > 0) {
        let sql = "UPDATE users SET password =? WHERE email =?";
        con.query(
          sql,
          [data.password, data.email],
          function (error, result, rows, fields) {
            if (error) {
              throw error;
            } else {
              resp.status(200);
              console.log({ success: "success" });
              resp.send({ success: "success" });
            }
          }
        );
      } else {
        resp.status(400);
        console.log({ result: "Invalid Email" });
        resp.send({ result: "Invalid Email" });
      }
    }
  );
});

app.post("/users", verifyToken, (req, resp) => {
  const data = req.body;
  const user_id = req.user.id; // Access the user_id from the decoded user object
  console.log("user_id", user_id);
  if (user_id != data.user_id) {
    resp
      .status(401)
      .send({ result: "Unauthorized. User ID in the token does not match." });
  } else {
    con.query(
      `SELECT id, datetime, date, user_role, name, email, phone, city, state, otp, status, profile_picture FROM users`,
      function (err, result) {
        if (err) {
          throw err;
        }
        if (result.length > 0) {
          resp.status(200);
          console.log(result);
          resp.send(result);
        } else {
          resp.status(400);
          console.log({ error: "Invalid Credentials" });
          resp.send({ error: "Invalid Credentials" });
        }
      }
    );
  }
});

app.post("/updatetime", verifyToken, (req, resp) => {
  const data = req.body;
  const user_id = req.user.id; // Access the user_id from the decoded user object
  console.log("user_id", user_id);
  if (user_id != data.user_id) {
    resp
      .status(401)
      .send({ result: "Unauthorized. User ID in the token does not match." });
  } else {
    let sql =
      "UPDATE web_popup SET date =?, status =?, show_time =? WHERE user_id = ?";
    con.query(
      sql,
      [data.date, data.status, data.show_time, data.user_id],
      function (error, result, rows, fields) {
        if (error) {
          throw error;
        } else {
          resp.status(200);
          console.log(result);
          resp.send(result);
        }
      }
    );
  }
});

app.post("/delete_user", verifyToken, (req, resp) => {
  const data = req.body;
  const user_id = req.user.id; // Access the user_id from the decoded user object
  console.log("user_id", user_id);
  if (user_id != data.user_id) {
    resp
      .status(401)
      .send({ result: "Unauthorized. User ID in the token does not match." });
  } else {
    con.query(
      `DELETE FROM users WHERE id = '${data.id}'`,
      function (err, result) {
        if (err) {
          throw err;
        } else {
          con.query(
            `DELETE FROM web_popup WHERE user_id = '${data.id}'`,
            function (err, result) {
              if (err) {
                throw err;
              } else {
                resp.status(200);
                console.log(result);
                resp.send(result);
              }
            }
          );
        }
      }
    );
  }
});

app.post("/user_disabled", verifyToken, (req, resp) => {
  const data = req.body;

  const user_id = req.user.id; // Access the user_id from the decoded user object
  console.log("user_id", user_id);
  if (user_id != data.admin_id) {
    resp
      .status(401)
      .send({ result: "Unauthorized. User ID in the token does not match." });
  } else {
    let sql = "UPDATE users SET status =? WHERE id = ?";
    con.query(
      sql,
      [data.status, data.user_id],
      function (error, result, rows, fields) {
        if (error) {
          throw error;
        } else {
          resp.status(200);
          console.log(result);
          resp.send(result);
        }
      }
    );
  }
});

app.post("/search_users_by_country", verifyToken, (req, resp) => {
  const data = req.body;

  const user_id = req.user.id; // Access the user_id from the decoded user object
  console.log("user_id", user_id);
  if (user_id != data.user_id) {
    resp
      .status(401)
      .send({ result: "Unauthorized. User ID in the token does not match." });
  } else {
    con.query(
      `SELECT id, datetime, date, user_role, name, email, phone, city, state, otp, status, profile_picture FROM users WHERE city = '${data.country}'`,
      function (err, result) {
        if (err) {
          throw err;
        }
        if (result.length > 0) {
          resp.status(200);
          console.log(result);
          resp.send(result);
        } else {
          resp.status(400);
          console.log({ error: "Invalid Country" });
          resp.send({ error: "Invalid Country" });
        }
      }
    );
  }
});

app.post("/search_users_by_name", verifyToken, (req, resp) => {
  const data = req.body;

  const user_id = req.user.id; // Access the user_id from the decoded user object
  console.log("user_id", user_id);
  if (user_id != data.user_id) {
    resp
      .status(401)
      .send({ result: "Unauthorized. User ID in the token does not match." });
  } else {
    con.query(
      `SELECT id, datetime, date, user_role, name, email, phone, city, state, otp, status, profile_picture FROM users WHERE name = '${data.name}'`,
      function (err, result) {
        if (err) {
          throw err;
        }
        if (result.length > 0) {
          resp.status(200);
          console.log(result);
          resp.send(result);
        } else {
          resp.status(400);
          console.log({ error: "Invalid Name" });
          resp.send({ error: "Invalid Name" });
        }
      }
    );
  }
});

function verifyToken(req, resp, next) {
  let token = req.headers["authorization"];
  if (token) {
    token = token.split(" ")[1];
    Jwt.verify(token, jwtkey, (err, decoded) => {
      if (err) {
        resp.status(401).send({ result: "Please provide valid token" });
      } else {
        req.user = decoded.result[0];
        next();
      }
    });
  } else {
    resp.status(403).send({ result: "Please add token with header" });
  }
}

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`server running on ${PORT}`);
});
