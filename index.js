var express = require("express");
var bodyparser = require("body-parser");
var util = require("util");
var session = require("express-session");
var url = require("url");
var mysql = require("mysql2")
require("dotenv").config();



var conn = mysql.createConnection({
    host:"bwjw0sia1vtykhdgsbfy-mysql.services.clever-cloud.com",
    user:"urbym4uihwfra8wl",
    password:"urbym4uihwfra8wl",
    database:"bwjw0sia1vtykhdgsbfy"
})

var app = express();
var exe = util.promisify(conn.query).bind(conn);
app.use(express.static("public/"))
app.use(bodyparser.urlencoded());


app.use(session({
    secret:"tushar8787",
    resave : false,
    saveUninitialized :true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));


app.get("/", async function (req,res){
    res.render("staff.ejs")
})

app.post("/staff/register",async function (req,res){
    try{
    var d = req.body;
    var sql = `insert into staff(staff_name,staff_hospital_name,staff_mobile,staff_email,staff_password) values (?,?,?,?,?)`;
    var result = await exe(sql,[d.staff_name, d.staff_hospital_name, d.staff_mobile, d.staff_email, d.staff_password]);
    req.session.staff_id = result.insertId;
    // res.send(req.body);
    res.redirect("/dashboard");
    }catch(err){
        res.send("Email OR Mobile Number Already Exits");
    }
})

app.post("/staff/login",async function (req,res){
    var d = req.body;
    var sql= `select * from staff where staff_email = ? and staff_password = ?`;
    var result = await exe (sql,[d.staff_email,d.staff_password]);
    if(result.length > 0){
        req.session.staff = result[0];
        res.redirect("/dashboard");
    }else{
        res.send("Login Failed");
    }    
});

function verifyLogin(req,res,next){  
    req.session.staff_id = 1;    
    if(req.session.staff){
        next();
    }else{
        res.redirect("/");
    }
}

app.get("/dashboard", verifyLogin, async function (req, res) {
    var staff = req.session.staff;

    // === Dashboard Stats ===
    let doctors = await exe("SELECT COUNT(*) AS total FROM doctor");
    let patients = await exe("SELECT COUNT(*) AS total FROM appointment");
    let appointmentsToday = await exe(`
      SELECT COUNT(*) AS total 
      FROM appointment 
      WHERE DATE(appointment_date) = CURDATE()
    `);
    let pending = await exe(`
      SELECT COUNT(*) AS total 
      FROM appointment 
      WHERE appointment_status = 'Scheduled'
    `);
    let upcoming = await exe(`
      SELECT COUNT(*) AS total 
      FROM appointment 
      WHERE appointment_date >= CURDATE()
    `);

    // === Today's Appointments List ===
    let todaysAppointments = await exe(`
      SELECT a.appointment_id, 
             a.patient_name, 
             a.appointment_date, 
             a.appointment_status,
             d.doctor_name
      FROM appointment a
      JOIN doctor d ON a.doctor_id = d.doctor_id
      WHERE DATE(a.appointment_date) = CURDATE()
      ORDER BY a.appointment_date ASC
      LIMIT 10
    `);

    // Pass everything to EJS
    res.render("dashboard.ejs", {
      staff,
      stats: {
        doctors: doctors[0].total,
        patients: patients[0].total,
        today: appointmentsToday[0].total,
        pending: pending[0].total,
        upcoming: upcoming[0].total,
      },
      todaysAppointments
    });
});

app.get("/add_doctors",verifyLogin, async function (req,res){
    var staff = req.session.staff;
    var sql = `select * from doctor where staff_id= ?`;
    var doctors = await exe(sql,[req.session.staff_id]);
    var packet = {doctors ,staff}
    res.render("add_doctors.ejs",packet);
});

app.post("/save_doctor",verifyLogin, async function (req, res) {
    try {
        var d = req.body;
        var sql = `INSERT INTO doctor 
            (staff_id, doctor_name, doctor_specialization, doctor_in_time, doctor_out_time, avg_checkup_minutes) 
            VALUES (?, ?, ?, ?, ?, ?)`;

        var result = await exe(sql, [
            req.session.staff_id,
            d.doctor_name,
            d.doctor_specialization,
            d.doctor_in_time,
            d.doctor_out_time,
            d.avg_checkup_minutes
        ]);
        // req.session.doctor_id = result.insertId;
        res.redirect("/add_doctors"); 
    } catch (error) {
        console.error("Error saving doctor:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.get("/edit_doctor/:id",verifyLogin, async function (req, res) {
    var id = req.params.id;
    var sql = "SELECT * FROM doctor WHERE doctor_id = ?";
    var result = await exe(sql, [id]);
    var sql = "SELECT * FROM appointment";
    var result = await exe(sql);
    var packet = { appointments: result };
  
    res.send("/add_doctors")
});

app.post("/update_doctor",verifyLogin, async function (req, res) {
    var d = req.body;
    var sql = `UPDATE doctor 
               SET  doctor_name=?, doctor_specialization=?, doctor_in_time=?, doctor_out_time=?, avg_checkup_minutes=?
               WHERE doctor_id=?`;
    var result = await exe(sql,[d.doctor_name, d.doctor_specialization, d.doctor_in_time, d.doctor_out_time, d.avg_checkup_minutes, d.doctor_id]);
    res.redirect("/add_doctors");
});

app.get("/delete_doctors/:id",verifyLogin, async function (req, res) {
    // var id = req.params.id;
    var sql = `DELETE FROM doctor WHERE doctor_id = ?`;
    var result= await exe(sql, [req.params.id]);
    res.redirect("/add_doctors");
});

app.get("/appointments",verifyLogin, async function (req,res){

    var urldata = url.parse(req.url,true).query;
    var sql2= `select *,(select count(*)from appointment where appointment.doctor_id = doctor.doctor_id)as total_appointments from doctor where staff_id = ?`;
    var doctors = await exe(sql2,[req.session.staff_id]); 

    if(urldata.doctor_id)
    {
    var sql = `SELECT * FROM appointment,doctor WHERE appointment.doctor_id = doctor.doctor_id and appointment.staff_id = ? and appointment.doctor_id = ?`;
    var appointments = await exe(sql, [req.session.staff_id,urldata.doctor_id]);
    }else{
    var sql = "SELECT * FROM appointment,doctor WHERE appointment.doctor_id = doctor.doctor_id and appointment.staff_id = ?";
    var appointments = await exe(sql, [req.session.staff_id]);
    }
    
    var packet = {doctors,appointments};
    res.render("appointments.ejs",packet);
    
});

app.post("/save_appointment",verifyLogin, async function (req, res){
    var d = req.body;
    var sql = ` insert into appointment (staff_id, doctor_id, patient_name, patient_mobile, patient_address, patient_disease_note, appointment_date) values (?,?,?,?,?,?,?)`;
    var result= await exe(sql,[req.session.staff_id ,d.doctor_id,d.patient_name, d.patient_mobile, d.patient_address, d.patient_disease_note, d.appointment_date]);
    // res.send(result);
    res.redirect("/appointments");
});

app.get("/appointments/details/:id",verifyLogin,async function (req,res){
    var sql = `select * from appointment,doctor where appointment.doctor_id = doctor.doctor_id and appointment.appointment_id = ?`;
    var info = await   exe(sql, [req.params.id]);
    var packet = {info};
    res.render("appointment_details.ejs",packet);
})

app.post("/update_appointment/:id",verifyLogin, async function (req, res) {
    let d = req.body;
    let sql = `
      UPDATE appointment 
      SET staff_id=?, doctor_id=?, patient_name=?, patient_mobile=?, patient_address=?, 
          patient_disease_note=?, appointment_date=?, appointment_start_time=?, appointment_end_time=?, 
          prescription=?, patient_age=?, patient_gender=?, purpose_of_visit=?, appointment_status=? 
      WHERE appointment_id=?`;

    await exe(sql, [
      d.staff_id,
      d.doctor_id,
      d.patient_name,
      d.patient_mobile,
      d.patient_address,
      d.patient_disease_note,
      d.appointment_date,
      d.appointment_start_time,
      d.appointment_end_time,
      d.prescription,
      d.patient_age,
      d.patient_gender,
      d.purpose_of_visit,
      d.appointment_status,
      req.params.id,
    ]);
    // Redirect back to appointment details after update
    res.redirect("/appointments/details/" + req.params.id);
    // res.send(d);
});



 app.get("/edit_appointments/:id",verifyLogin, async function (req,res){
    var id = req.params.id;
    var sql = "SELECT * FROM appointment WHERE appointment_id = ?";
    var appointments = await exe(sql, [id]);
    var packet = { appointments};
    res.render("appointment.ejs",packet);

 })

 app.post("/update_appointment",verifyLogin, async function (req,res){
    var d = req.body;
    var sql = `update appointment set doctor_id=?, patient_name =?, patient_mobile=?, patient_address=?, patient_disease_note=?, appointment_date=?, appointment_status =? where appointment_id = ?`;
    var result = await exe(sql,[d.doctor_id,d.patient_name,d.patient_mobile,d.patient_address,d.patient_disease_note,d.appointment_date,d.appointment_status, d.appointment_id]);
    // res.send(d);
    res.redirect("/appointments")
})

    app.get("/Delete_appointments/:appointment_id",verifyLogin, async function (req, res) {
    let sql = "DELETE FROM appointment WHERE appointment_id = ?";
    await exe(sql, [req.params.appointment_id]);
    res.redirect("/appointments");
});

app.get("/staff", async function (req,res){
    res.render("staff.ejs");
    
})




app.get("/profile",verifyLogin,async function(req,res){
    var sql = `select * from staff where staff_id = ?`;
    var staff = await exe(sql,[req.session.staff_id]);
    var packet = { staff }
    res.render("profile.ejs",packet);
})


app.get("/logout", function (req, res) {
    req.session.destroy(function (err) {
        if (err) {
            console.log("Error destroying session:", err);
        }
        res.redirect("/");
    });
});


app.listen(process.env.PORT || 1000);