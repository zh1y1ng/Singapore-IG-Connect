const express = require('express');
const mysql = require('mysql2');
const session = require( 'express-session');
const flash = require( 'connect-flash' );

const app = express();
app.set('view engine', 'ejs');

const db = mysql.createPool({
    host: 'e3-0eg.h.filess.io',
    port: 3307,
    user: 'SingaporeIGConnect_beautyfast',
    password: '8f7baaabd3341fffcf08865ea704a1e3d1766a29',
    database: 'SingaporeIGConnect_beautyfast',
});

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static('public'));

app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

app.use(flash());

const validateRegistration = (req, res, next) => {
    const { username, email, password, address, contact } = req.body;

    if (!username || !email || !password || !address || !contact) {
        return res.status(400).send('All fields are required.');
    }

    if (password.length < 6) {
        req.flash('error', 'Password should be at least 6 or more characters long');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }
    next();
};

app.get('/', (req, res) => {
    res.render('index', { user: req.session.user, messages: req.flash('success')});
});

app.get('/register', (req, res) => {
    res.render('register', {
        errors: req.flash('error'),
        formData: req.flash('formData')[0] || {}
    });
}); 

app.post('/register', validateRegistration, (req, res) => {

    const { username, email, password, address, contact, role } = req.body;

    const sql = 'INSERT INTO users (username, email, password, address, contact, role) VALUES (?, ?, SHA1(?), ?, ?, ?)';
    db.query(sql, [username, email, password, address, contact, role], (err, result) => {
        if (err) {
            throw err;
        }
        console.log(result);
        req.flash('success', 'Registration successful! Please log in.');
        res.redirect('/login');
    });
});

app.get('/login', (req, res) => {

    res.render('login', {
        messages: req.flash('success'),
        errors: req.flash('error')
    });
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        req.flash('error', 'All fields are required.');
        return res.redirect('/login');
    }

    const sql = 'SELECT * FROM users WHERE email = ? AND password = SHA1(?)';
    db.query(sql, [email, password], (err, results) => {
        if (err) {
            throw err;
        }

        if (results.length > 0) {
            req.session.user = results[0];
            res.redirect('/dashboard');
        } else {
            req.flash('error', 'Invalid email or password.');
            res.redirect('/login');
        }
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

const checkAuthentication = (req, res, next) => {
    if (req.session.user) {
        return next();
    } else {
        req.flash('error', 'Please log in to view this resource.');
        res.redirect('/login');
    }
};

const checkAdmin = (req, res, next) => {
    if (req.session.user.role === 'admin') {
        return next();
    } else {
        req.flash('error', 'Access denied');
        res.redirect('/dashboard');
    }
};

app.get('/dashboard', checkAuthentication, (req, res) => {
    res.render('dashboard', { 
        user: req.session.user,
        messages: req.flash('success')
    });
});

app.get('/admin', checkAuthentication, checkAdmin, (req, res) => {
    res.render('admin', { user: req.session.user });
});

// --- zhiying code ---

// --- View all schools (Both user & admin) ---
app.get('/schools', checkAuthentication, (req, res) => {
    const query = 'SELECT * FROM schools';
    db.query(query, (err, results) => {
        if (err) throw err;
        res.render('schools/index', {
            schools: results,
            user: req.session.user
        });
    });
});

// --- Search school by name/location (Both user & admin) ---
app.get('/schools/search', checkAuthentication, (req, res) => {
    const keyword = req.query.keyword;
    const query = `
        SELECT * FROM schools 
        WHERE name LIKE ? OR address LIKE ?
    `;
    db.query(query, [`%${keyword}%`, `%${keyword}%`], (err, results) => {
        if (err) throw err;
        res.render('schools/index', {
            schools: results,
            user: req.session.user
        });
    });
});

// --- Show Add School Form (Admin only) ---
app.get('/schools/addSchool', checkAuthentication, checkAdmin, (req, res) => {
    res.render('schools/addSchool', { user: req.session.user});
});

// --- Add School (Admin only) ---
app.post('/schools', checkAuthentication, checkAdmin, (req, res) => {
    const { name, address, contact_email, logo_url } = req.body;

    if (!name || !address || !contact_email) {
        req.flash('error', 'Please fill in all required fields.');
        return res.redirect('/schools/addSchool');
    }

    const query = 'INSERT INTO schools (name, address, contact_email, logo_url) VALUES (?, ?, ?, ?)';
    db.query(query, [name, address, contact_email, logo_url], (err) => {
        if (err) throw err;
        res.redirect('/schools');
    });
});

// --- Show Edit Form (Admin only) ---
app.get('/schools/editSchool/:id', checkAuthentication, checkAdmin, (req, res) => {
    const id = req.params.id;
    const query = 'SELECT * FROM schools WHERE id = ?';
    db.query(query, [id], (err, results) => {
        if (err) throw err;
        res.render('schools/editSchool', { school: results[0], user: req.session.user });
    });
});

// --- Update School (Admin only) ---
app.post('/schools/update/:id', checkAuthentication, checkAdmin, (req, res) => {
    const { name, address, contact_email, logo_url } = req.body;
    const query = 'UPDATE schools SET name = ?, address = ?, contact_email = ?, logo_url = ? WHERE id = ?';
    db.query(query, [name, address, contact_email, logo_url, req.params.id], (err) => {
        if (err) throw err;
        res.redirect('/schools');
    });
});

// --- Delete School (Admin only) ---
app.post('/schools/delete/:id', checkAuthentication, checkAdmin, (req, res) => {
    const id = req.params.id;
    const query = 'DELETE FROM schools WHERE id = ?';
    db.query(query, [id], (err) => {
        if (err) throw err;
        res.redirect('/schools');
    });
});

// --- basil ---
const { name } = require("ejs");

function checkAuthentication(req, res, next) {
    if (req.session.user) return next();
    res.redirect('/login');
}

function checkAdmin(req, res, next) {
    if (req.session.user && req.session.user.role === 'admin') return next();
    res.status(403).send('Access denied. Admins only.');
}

// view and searchs IGs
app.get('/ig', checkAuthentication, (req, res) => {
    const sql = 'SELECT * FROM interest_groups';
    db.query(sql, (err, results) => {
        if (err) throw err;
        res.render('ig/index', { igs: results, user: req.session.user });
    });
});

// add new IG - Admin
app.get('/ig/addIg', checkAuthentication, checkAdmin, (req, res) => {
    res.render('ig/addIg'); // Make sure your file is views/ig/addIg.ejs
});

app.post('/ig', checkAuthentication, checkAdmin, (req, res) => {
    const { name, category, description } = req.body;
    const sql = 'INSERT INTO interest_groups (name, category, description) VALUES (?, ?, ?)';
    db.query(sql, [name, category, description], (err) => {
        if (err) throw err;
        res.redirect('/ig');
    });
});


// edit IG details - Admin
app.get('/ig/:id/edit', checkAuthentication, checkAdmin, (req, res) => {
    const id = req.params.id;
    db.query('SELECT * FROM interest_groups WHERE id = ?', [id], (err, results) => {
        if (err) {
            res.status(500).send('Database error');
        } else {
            const ig = results[0];
            res.render('ig/edit', { ig });
        }
    });
});

app.post('/ig/:id', checkAuthentication, checkAdmin, (req, res) => {
    const id = req.params.id;
    const { name, category, description } = req.body;
    const sql = 'UPDATE interest_groups SET name = ?, category = ?, description = ? WHERE id = ?';
    db.query(sql, [name, category, description, id], (err) => {
        if (err) throw err;
        res.redirect('/ig');
    });
});


// delete IG - Admin
app.post('/ig/:id/delete', checkAuthentication, checkAdmin, (req, res) => {
    const sql = 'DELETE FROM interest_groups WHERE id = ?';
    db.query(sql, [req.params.id], (err) => {
        if (err) throw err;
        res.redirect('/ig');
    });
});

// --- shahideen code ---

// GET all or search members
app.get('/members', checkAuthentication, (req, res) => {
    const keyword = req.query.keyword;
    let sql = `
        SELECT members.id, students.name AS student_name, interest_groups.name AS ig_name, role, joined_date
        FROM members
        JOIN students ON members.student_id = students.id
        JOIN interest_groups ON members.ig_id = interest_groups.id
    `;
    const params = [];

    if (keyword) {
        sql += ` WHERE students.name LIKE ? OR interest_groups.name LIKE ?`;
        const searchTerm = `%${keyword}%`;
        params.push(searchTerm, searchTerm);
    }

    db.query(sql, params, (err, results) => {
        if (err) throw err;
        res.render('members/index', { members: results, keyword, user: req.session.user });
    });
});

// GET form to add member (admin only)
app.get('/members/addmember', checkAuthentication, checkAdmin, (req, res) => {
    const fetchStudents = 'SELECT id, name FROM students';
    const fetchIGs = 'SELECT id, name FROM interest_groups';

    db.query(fetchStudents, (err, students) => {
        if (err) throw err;
        db.query(fetchIGs, (err, igs) => {
            if (err) throw err;
            res.render('members/addmember', { students, igs, user: req.session.user });
        });
    });
});

// POST add member (admin only)
app.post('/members', checkAuthentication, checkAdmin, (req, res) => {
    const { student_id, ig_id, role, joined_date } = req.body;
    const sql = 'INSERT INTO members (student_id, ig_id, role, joined_date) VALUES (?, ?, ?, ?)';
    db.query(sql, [student_id, ig_id, role, joined_date], (err) => {
        if (err) throw err;
        res.redirect('/members');
    });
});

// GET edit form (admin only)
app.get('/members/edit/:id', checkAuthentication, checkAdmin, (req, res) => {
    const memberId = req.params.id;
    const sql = `
        SELECT members.*, students.name AS student_name, interest_groups.name AS ig_name
        FROM members
        JOIN students ON members.student_id = students.id
        JOIN interest_groups ON members.ig_id = interest_groups.id
        WHERE members.id = ?
    `;
    db.query(sql, [memberId], (err, results) => {
        if (err) throw err;
        if (results.length === 0) return res.status(404).send('Member not found');
        res.render('members/editmember', { member: results[0], user: req.session.user });
    });
});

// POST update member role (admin only)
app.post('/members/edit/:id', checkAuthentication, checkAdmin, (req, res) => {
    const memberId = req.params.id;
    const { role } = req.body;
    const sql = 'UPDATE members SET role = ? WHERE id = ?';
    db.query(sql, [role, memberId], (err) => {
        if (err) throw err;
        res.redirect('/members');
    });
});

// DELETE member (admin only)
app.post('/members/:id/delete', checkAuthentication, checkAdmin, (req, res) => {
    const sql = 'DELETE FROM members WHERE id = ?';
    db.query(sql, [req.params.id], (err) => {
        if (err) throw err;
        res.redirect('/members');
    });
});

// --- tengyang code -----

app.get('/events', checkAuthentication, (req, res) => {
    db.query('SELECT * FROM events', (error, results) => {
        if (error) return res.status(500).send('Error retrieving events');
        res.render('events', { events: results, user: req.session.user });
    });
});



app.get('/events/new', checkAuthentication, (req, res) => {
    const sql = 'SELECT * FROM events';  // Adjust table name if different
    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Database error');
        }

        res.render('events/new', {
            user: req.session.user,
            events: results  // pass the events array to the view
        });
    });
});


app.get('/events/:id', (req, res) => {
    db.query('SELECT * FROM events WHERE id = ?', [req.params.id], (error, results) => {
        if (error) return res.status(500).send('Error retrieving event');
        if (results.length > 0) {
            res.render('events/details', { event: results[0], user: req.session.user });
        } else {
            res.status(404).send('Event not found');
        }
    });
});

app.get('/addEvent', checkAuthentication, (req, res) => {
    res.render('addEvent', { user: req.session.user });
});

app.post('/addEvent', (req, res) => {
    const { name, date, location, description } = req.body;
    db.query(
        'INSERT INTO events (name, date, location, description) VALUES (?, ?, ?, ?)',
        [name, date, location, description],
        (error) => {
            if (error) return res.status(500).send('Error adding event');
            res.redirect('/events');
        }
    );
});

app.get('/editEvent/:id', (req, res) => {
    db.query('SELECT * FROM events WHERE id = ?', [req.params.id], (error, results) => {
        if (error) return res.status(500).send('Error retrieving event');
        res.render('editEvent', { event: results[0], user: req.session.user });
    });
});

app.post('/editEvent/:id', (req, res) => {
    const { name, date, location, description } = req.body;

    const sql = 'UPDATE events SET name = ?, date = ?, location = ?, description = ? WHERE id = ?';
    const values = [name, date, location, description, req.params.id];

    db.query(sql, values, (error) => {
        if (error) {
            console.error('MySQL error:', error);
            return res.status(500).send('Error updating event');
        }
        res.redirect('/events');
    });
});



app.get('/deleteEvent/:id', (req, res) => {
    db.query('DELETE FROM events WHERE id = ?', [req.params.id], (error) => {
        if (error) return res.status(500).send('Error deleting event');
        res.redirect('/events');
    });
});

// --- pekwen code ------------------------

// IG Galleries Routes
app.get('/galleries', checkAuthentication, (req, res) => {
    const search = req.query.search || '';
    const query = `
        SELECT * FROM galleries
        WHERE caption LIKE ? OR upload_date LIKE ?
        ORDER BY upload_date DESC
    `;

    db.query(query, [`%${search}%`, `%${search}%`], (err, results) => {
        if (err) throw err;
        res.render('galleries/galleries', {
            user: req.session.user,
            galleries: results,
            search
        });
    });
});

// Admin only - Add new gallery item
app.get('/galleries/new', checkAuthentication, checkAdmin, (req, res) => {
    res.render('galleries/gallery_form', { gallery: null });
});

app.post('/galleries', checkAuthentication, checkAdmin, (req, res) => {
    const { ig_id, media_url, caption, upload_date } = req.body;
    const sql = 'INSERT INTO galleries (ig_id, media_url, caption, upload_date) VALUES (?, ?, ?, ?)';
    db.query(sql, [ig_id, media_url, caption, upload_date], (err, result) => {
        if (err) throw err;
        res.redirect('/galleries');
    });
});

// Admin only - Edit gallery item
app.get('/galleries/:id/edit', checkAuthentication, checkAdmin, (req, res) => {
    const id = req.params.id;
    db.query('SELECT * FROM galleries WHERE id = ?', [id], (err, results) => {
        if (err) {
            res.status(500).send('Database error');
        } else {
            const gallery = results[0];
            res.render('galleries/gallery_form', { gallery });
        }
    });
});

app.post('/galleries/:id', checkAuthentication, checkAdmin, (req, res) => {
    const id = req.params.id;
    const { ig_id, media_url, caption, upload_date } = req.body;
    const sql = 'UPDATE galleries SET ig_id = ?, media_url = ?, caption = ?, upload_date = ? WHERE id = ?';
    db.query(sql, [ig_id, media_url, caption, upload_date, id], (err, result) => {
        if (err) throw err;
        res.redirect('/galleries');
    });
});

// Admin only - Delete gallery item
app.post('/galleries/:id/delete', checkAuthentication, checkAdmin, (req, res) => {
    const id = req.params.id;
    db.query('DELETE FROM galleries WHERE id = ?', [id], (err, result) => {
        if (err) throw err;
        res.redirect('/galleries');
    });
});

// --- inarah ---------
app.get('/students', checkAuthentication, (req, res) => {
    const search = req.query.search || '';
    const sql = `SELECT * FROM students WHERE name LIKE ? OR email LIKE ?`;
    db.query(sql, [`%${search}%`, `%${search}%`], (err, results) => {
        if (err) throw err;
        res.render('students/index', { students: results, user: req.session.user });
    });
});

app.get('/students/new', checkAuthentication, checkAdmin, (req, res) => {
    res.render('students/newstudent');
});

app.post('/students', checkAuthentication, checkAdmin, (req, res) => {
    const { name, school_id, email, interests, profile_pic } = req.body;
    const sql = `INSERT INTO students (name, school_id, email, interests, profile_pic) VALUES (?, ?, ?, ?, ?)`;
    db.query(sql, [name, school_id, email, interests, profile_pic], (err) => {
        if (err) throw err;
        res.redirect('/students');
    });
});

app.get('/students/edit/:id', checkAuthentication, checkAdmin, (req, res) => {
    const sql = `SELECT * FROM students WHERE id = ?`;
    db.query(sql, [req.params.id], (err, result) => {
        if (err) throw err;
        if (result.length === 0) {
            req.flash('error', 'Student not found');
            return res.redirect('/students');
        }
        res.render('students/editstudent', { student: result[0] });
    });
});

app.post('/students/update/:id', checkAuthentication, checkAdmin, (req, res) => {
    const { name, school_id, email, interests, profile_pic } = req.body;
    const sql = `UPDATE students SET name=?, school_id=?, email=?, interests=?, profile_pic=? WHERE id=?`;
    db.query(sql, [name, school_id, email, interests, profile_pic, req.params.id], (err) => {
        if (err) {
            console.error('Update student error:', err);
            req.flash('error', 'Failed to update student.');
            return res.redirect('/students/edit/' + req.params.id);
        }
        res.redirect('/students');
    });
});



app.post('/students/delete/:id', checkAuthentication, checkAdmin, (req, res) => {
    db.query('DELETE FROM students WHERE id = ?', [req.params.id], (err) => {
        if (err) throw err;
        res.redirect('/students');
    });
});


// About Us page
app.get('/aboutus', (req, res) => {
  res.render('about');
});

// Contact Us page
app.get('/contactus', (req, res) => {
  res.render('contact');
});


app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
