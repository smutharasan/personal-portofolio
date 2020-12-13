//#region ********* HEADER********************
//  * Name: Supriya Mutharasan
//  * Date: 12/10/2020
//#endregion

//#region setup our modules
const HTTP_PORT = process.env.PORT || 8080;
const express = require("express");
const app = express();
const path = require("path");
const _ = require("underscore");
const fs = require("fs");
const moment = require('moment')
const mongoose = require("mongoose");
const bcrypt = require('bcryptjs'),
  SALT_WORK_FACTOR = 10;
const bodyParser = require('body-parser');
const multer = require("multer");
const exphbs = require("express-handlebars");
const clientSessions = require("client-sessions");
const PHOTODIRECTORY = "./static/photos/";
const config = require("./static/src/config.js");
const connectionString = config.atlas_database_connection_string;
// const UserModel = require("./static/src/UserModel");
// const RoomModel = require("./static/src/RoomModel").Rooms;
// const PhotoModel = require("./static/src/RoomModel").Photos;
// const BookedRoomModel = require("./static/src/BookedRoomModel");

// some kind of user directory
//#endregion 

//#region set middleware
app.use(express.static('static'));

// Setup client-sessions
app.use(clientSessions({
  cookieName: "session", // this is the object name that will be added to 'req'
  secret: "personal_website_smutharasan_born_on_december_three", // this should be a long un-guessable string.
  duration: 2 * 60 * 1000, // duration of the session in milliseconds (2 minutes)
  activeDuration: 1000 * 60 // the session will be extended by this many ms each request (1 minute)
}));

var urlenParser = bodyParser.urlencoded({
  extended: true
});

if (!fs.existsSync(PHOTODIRECTORY)) {
  fs.mkdirSync(PHOTODIRECTORY);
}

// multer requires a few options to be setup to store files with file extensions
// by default it won't store extensions for security reasons
const storage = multer.diskStorage({
  destination: PHOTODIRECTORY,
  filename: (req, file, cb) => {
    // we write the filename as the current date down to the millisecond
    // in a large web service this would possibly cause a problem if two people
    // uploaded an image at the exact same time. A better way would be to use GUID's for filenames.
    // this is a simple example.
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

// tell multer to use the diskStorage function for naming files instead of the default.
const upload = multer({
  storage: storage
});

// connect to your mongoDB database
mongoose.connect(connectionString, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true
});

// log when the DB is connected
mongoose.connection.on("open", () => {
  console.log("Database connection open.");
});

//#endregion

//#region // Server side validation
function serverSideSignUpFormValidate(givenUserObj) {

  /*Minimum ten characters, at least one uppercase letter, one lowercase letter, one number and one special character: */
  const passwordExp = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{10,}$/;
  var validationFlag = true;

  var signUpFormFirstName = givenUserObj.signUpFormFirstName;
  var signUpFormLastName = givenUserObj.signUpFormLastName;
  var signUpFormUsername = givenUserObj.signUpFormUsername;
  var signUpFormEmail = givenUserObj.signUpFormEmail;
  var signUpFormPassword = givenUserObj.signUpFormPassword;

  if (signUpFormFirstName === "") validationFlag = false;

  if (signUpFormLastName === "") validationFlag = false;

  if (signUpFormUsername === "") validationFlag = false;

  if (signUpFormEmail === "") validationFlag = false;

  if (!(signUpFormPassword.match(passwordExp))) validationFlag = false;

  return validationFlag;
}

function serverSideSignInFormValidate(givenUserObj) {
  const passwordExp = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{10,}$/;

  var validationFlag = true;

  var signInFormUsername = givenUserObj.signInFormUsername;
  var signInFormPassword = givenUserObj.signInFormPassword;

  if (signInFormUsername === "") validationFlag = false;

  if (!(signInFormPassword.match(passwordExp))) validationFlag = false;

  return validationFlag;
}

function ensureLogin(req, res, next) {
  if (!req.session.user) {
    res.redirect("/home#modalLoginForm");
  } else {
    next();
  }
};

function ensureAdminLogin(req, res, next) {
  if (!req.session.user.isAdmin){
    res.redirect("/home#modalLoginForm");}
  else{
    next();
  } 
};

// call this function after the http server starts listening for requests
function onHttpStart() {
  console.log("Express http server listening on: " + HTTP_PORT);
}
//#endregion



//#region Register handlerbars as the rendering engine for views
app.set("views", "./views");
app.set("layout", "./views/layout");
app.engine(".hbs", exphbs({
  extname: ".hbs"
}));
app.set("view engine", ".hbs");
//#endregion

//#region Setting up routes that use GET Method
app.get("/", (req, res) => {
  res.redirect("/home");
});

app.get("/home", (req, res) => {

  res.render("viewhome", {
    registeredUser: req.session.user,
    errorsPresent: req.session.err,
    layout: 'home' // do not use the default Layout (main.hbs)
  });
});

app.get("/dashboard", ensureLogin, (req, res) => {
  console.log(req.session.user);
  if (!req.session.user.isAdmin) {
    console.log("rendering dashboard");

    UserModel.findOne({
        user_name_user: req.session.user.username
      })
      .lean()
      .exec()
      .then((result) => {

        var hasRoomListings = (result.booked_rooms_array.length > 0 ? true : false);

        res.render("viewDashboard", {
          registeredUser: req.session.user,
          errorsPresent: req.session.err,
          hasRoomListings: hasRoomListings,
          roomListings: result.booked_rooms_array,
          layout: 'home' // do not use the default Layout (main.hbs)
        });

      }).catch((err) => {
        console.error(err);
      });


  } else res.redirect('/adminDashboard');
});

app.get("/adminDashboard", ensureLogin, ensureAdminLogin, (req, res) => {

  res.render("viewAdminDashboard", {
    registeredUser: req.session.user,
    errorsPresent: req.session.err,
    layout: 'home' // do not use the default Layout (main.hbs)
  });
});





app.get("/roomListings/:destination", (req, res, next) => {
  const givenDestination = req.params.destination;
  console.log(givenDestination);

  if (givenDestination != "Edit") {

    RoomModel.find({
        room_location: givenDestination
      })
      .lean()
      .exec()
      .then((roomListings) => {
        res.json({
          hasRoomListings: true,
          roomListings
        });
      }).catch((err) => {
        console.error(err);
      });
  } else {
    next('route');
  }

})

app.get("/roomListings/Edit", ensureLogin, ensureAdminLogin, (req, res, next) => {

  console.log("getting rendered");
  res.render("viewEditRoomListing", {
    registeredUser: req.session.user,
    errorsPresent: req.session.err,
    layout: 'home' // do not use the default Layout (main.hbs)
  });

});

app.get("/roomListings", (req, res) => {

  RoomModel.find()
    .lean()
    .exec()
    .then((roomList) => {
      _.each(roomList, (givenRoom) => {
        givenRoom.room_photo.uploadDate = new Date(givenRoom.room_photo.photo_created_at).toDateString();
      });

      // send the html view with our form to the client
      res.render("viewRoomListing", {
        registeredUser: req.session.user,
        errorsPresent: req.session.err,
        roomListings: roomList,
        hasRoomListings: !!roomList.length,
        layout: 'home' // do not use the default Layout (main.hbs)
      });
    });

});




app.get("/roomListings/Details/:roomTitle", ensureLogin, (req, res) => {

  const roomTitle = req.params.roomTitle;

  RoomModel.findOne({
      room_title: roomTitle
    })
    .lean()
    .exec()
    .then((roomListing) => {
      res.render("viewRoomListingDetails", {
        user: req.session.user,
        givenRoomListing: roomListing,
        errorsPresent: req.session.err,
        editStatus: true,
        layout: 'home'
      })

    }).catch((err) => {
      console.error(err);
    });
});

app.get("/roomListings/Delete/:roomTitle", ensureLogin, ensureAdminLogin, (req, res) => {
  const roomTitle = req.params.roomTitle;
  console.log(roomTitle);

  RoomModel.findOne({
      room_title: roomTitle
    })
    .lean()
    .exec()
    .then((roomListing) => {
      console.log(roomListing._id);
      console.log(roomListing.room_title);
      RoomModel.deleteOne({
        _id: roomListing._id
      }).then(() => {
        console.log("success");
        res.redirect("/roomListings");
      }).catch(err => console.error(err))

    }).catch(err => console.error(err))


})

app.get("/roomListings/edit/:roomTitle", ensureLogin, ensureAdminLogin, (req, res) => {
  const roomTitle = req.params.roomTitle;

  RoomModel.findOne({
      room_title: roomTitle
    })
    .lean()
    .exec()
    .then((roomListing) => {
      res.render("viewEditRoomListing", {
        user: req.session.user,
        givenRoomListing: roomListing,
        errorsPresent: req.session.err,
        editStatus: true,
        layout: 'home'
      })

    }).catch((err) => {
      console.error(err)
    });
});

app.get("/logout", (req, res) => {

  //registeredUser.validState = false;
  req.session.reset();
  res.redirect("/home");
});

app.get("/roomListings/logout", (req, res) => {

  //registeredUser.validState = false;
  res.redirect("/logout");
});

//#endregion

//#region Post routes
app.post("/register-user", urlenParser, (req, res) => {
  const formData = req.body;

  if (!serverSideSignUpFormValidate(formData)) {
    req.session.err = {
      errorMsg: "Incorrect Username or Password",
      errorStatus: true
    };
    return res.redirect("/home#modalRegisterForm");
  }

  bcrypt.hash(formData.signUpFormPassword, SALT_WORK_FACTOR).then(hash => {

    const registeredUserData = new UserModel({
      user_name_user: formData.signUpFormUsername,
      user_name_fist: formData.signUpFormFirstName,
      user_name_last: formData.signUpFormLastName,
      email: formData.signUpFormEmail,
      user_password: hash
    });

    registeredUserData.save()
      .then((response) => {
        req.session.user = {
          username: registeredUserData.user_name_user,
          email: registeredUserData.email,
          validState: true,
          firstName: registeredUserData.user_name_fist,
          lastName: registeredUserData.user_name_last,
          isAdmin: registeredUserData.isAdmin
        };
        res.redirect("/dashboard");
      })
      .catch((err) => {
        console.log("There was an error registering the user");
        console.error(err);
        req.session.err = {
          errorMsg: "Username already exists!",
          errorStatus: true
        };
        res.redirect("/home#modalRegisterForm");
      });
  }).catch(err => {
    console.log("Something went wrong, Please try again!")
    req.session.err = {
      errorMsg: "Something went wrong, Please sign in Again",
      errorStatus: true
    };
    res.redirect("/home#modalRegisterForm");
  });

});

app.post("/login-user", urlenParser, (req, res) => {
  const formData = req.body;
  if (!serverSideSignInFormValidate(formData)) {
    req.session.err = {
      errorMsg: "Incorrect Username or Password",
      errorStatus: true
    };
    return res.redirect("/home#modalLoginForm");
  }

  UserModel.find({
      user_name_user: formData.signInFormUsername
    })
    .exec()
    .then(givenUsers => {
      if (givenUsers.length < 1) {
        console.log("User does not exist!")
        req.session.err = {
          errorMsg: "Incoorect Username. Please try again",
          errorStatus: true
        };
        return res.redirect("/home#modalLoginForm");

      } else {

        bcrypt.compare(formData.signInFormPassword, givenUsers[0].user_password).then((result) => {
            if (result) {
              console.log("authentication successful");
              req.session.user = {
                username: givenUsers[0].user_name_user,
                email: givenUsers[0].email,
                validState: true,
                firstName: givenUsers[0].user_name_fist,
                lastName: givenUsers[0].user_name_last,
                isAdmin: givenUsers[0].isAdmin
              };

              UserModel.updateOne({
                user_name_user: givenUsers[0].user_name_user
              }, {
                $set: {
                  user_visit_last: new Date()
                }
              }).exec();
              return res.redirect("/dashboard");
              // do other stuff
            } else {
              console.log("authentication failed. Password doesn't match")
              req.session.err = {
                errorMsg: "Incorrect password",
                errorStatus: true
              };
              return res.redirect("/home#modalLoginForm");
            }
          })
          .catch(err => {
            console.log("Something went wrong, Please try again!");
            console.error(err);
            req.session.err = {
              errorMsg: "Something went wrong, Please try again!",
              errorStatus: true
            };
            res.redirect("/home#modalLoginForm");
          })
      }
    })
    .catch(err => {
      console.log('Internal server error: ', err);
      res.status(500).json({
        error: err,
        message: 'Error logging in'
      })
    });

});

app.post("/roomListings/Edit/edit-room", ensureLogin, ensureAdminLogin, upload.single("photo"), (req, res) => {

  console.log(req.body.editRLFormRoomDesc);

  const givenRoom = new RoomModel({
    room_title: req.body.editRLFormRoomTitle,
    room_price: parseFloat(req.body.editRLFormRoomPrice),
    room_description: req.body.editRLFormRoomDesc,
    room_location: req.body.editRLFormRoomLoc,
    room_photo: new PhotoModel({
      photo_filename: req.file.filename,
      photo_name: req.body.editRLFormRoomTitle,
      photo_owner_email: req.session.user.email
    })
  });

  if (req.body.editStatus === "1") {


    RoomModel.updateOne({
      room_title: givenRoom.room_title,
      room_location: givenRoom.room_location
    }, {
      $set: {
        room_title: givenRoom.room_title,
        room_price: givenRoom.room_price,
        room_description: givenRoom.room_description,
        room_location: givenRoom.room_location,
        room_photo: givenRoom.room_photo
      }
    }).exec().catch((err) => {
      console.error(err);
      res.redirect("/");
    });

    console.log("saved!");
    return res.redirect("/roomListings");
    //givenRoom.updateOne((err)=>{});

  } else {

    givenRoom.room_photo.save().then((result) => {

      givenRoom.save()
        .then((response) => {
          req.session.room = {
            validState: true,
            title: givenRoom.room_title,
            price: givenRoom.room_price,
            location: givenRoom.room_location
          };
          //console.log(locals.message);
          res.redirect("/roomListings");
        })
        .catch((err) => {
          console.log("There was an error registering the room");
          console.error(err);
          req.session.err = {
            errorMsg: "Room already exists!",
            errorStatus: true
          };
          res.redirect("/roomListings/Edit");
        });
    }).catch(err => console.error(err))
    //adding

  };
});

app.post("/roomListings/Details/book-room", ensureLogin, urlenParser, (req, res) => {

  const bookedRoom = new BookedRoomModel({
    room_title: req.body.detailsFormRoomTitle,
    room_price: parseFloat(req.body.detailsFormRoomPrice),
    room_location: req.body.detailsFormRoomLocation,
    children: req.body.detailsFormNumChildren,
    adults: req.body.detailsFormNumAdults,
    infants: req.body.detailsFormNumInfants,
    booked_start_date: new Date(moment(req.body.detailsFormCheckInDate, "YYYY-MM-DD")),
    booked_end_date: new Date(moment(req.body.detailsFormCheckOutDate, "YYYY-MM-DD"))
  });

  bookedRoom.save().then((resultBookedRoom) => {
    UserModel.updateOne({
      user_name_user: req.session.user.username
    }, {
      $push: {
        booked_rooms_array: resultBookedRoom
      }
    }).exec().then((resultUser) => {
      console.log("saved successfully!");
    }).catch((err) => {
      console.error(err);
    });

    res.redirect("/dashboard");
  }).catch((err) => {
    console.error(err);
    res.redirect("/");
  });



  // res.redirect("/");
});


//#endregion


//#region Admin Setup // Only run this once and only once
//app.get("/firstrunsetup", (req, res) => {

// User that exists -> priyaArasan03121999
// pwd -> Kingan11!!

//   adminPwd = "DrSharminIsAwesome3!!"

//   bcrypt.hash(adminPwd, SALT_WORK_FACTOR).then(hash => {

//     const Supriya = new UserModel({
//       user_name_user: 'priya03121999',
//       user_password: hash,
//       user_name_fist: 'Supriya',
//       user_name_last: 'Mutharasan',
//       email: 'smutharasan@myseneca.ca',
//       isAdmin: true
//     });

//     Supriya.save()
//       .then((response) => {
//         req.session.user = {
//           username: Supriya.user_name_user,
//           email: Supriya.email,
//           validState: true,
//           firstName: Supriya.user_name_fist,
//           lastName: Supriya.user_name_last,
//           isAdmin: Supriya.isAdmin
//         };
//         //console.log(locals.message);
//         res.redirect("/dashboard");
//       })
//       .catch((err) => {
//         console.log("There was an error registering the user");
//         req.session.err = {
//           errorMsg: "Incorrect Username or Password",
//           errorStatus: true
//         };
//         res.redirect("/home#modalRegisterForm");
//       });
//   }).catch(err => {
//     console.log("Something went wrong, Please try again!")
//     req.session.err = {
//       errorMsg: "Something went wrong, Please sign in Again",
//       errorStatus: true
//     };
//     res.redirect("/home#modalRegisterForm");
//   });

//})
//#endregion

app.listen(HTTP_PORT, onHttpStart);