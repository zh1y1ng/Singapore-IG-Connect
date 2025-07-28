const express = require('express');
const mysql = require('mysql2');
const session = require( 'express-session');
const flash = require( 'connect-flash' );

const app = express();
const schoolEventsData = {};
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
            user: req.session.user,
            searchTerm: ''
        });
    });
});

// --- Search school by name/location (Both user & admin) ---
app.get('/schools/search', checkAuthentication, (req, res) => {
    const keyword = req.query.keyword;
    const sql = 'SELECT * FROM schools WHERE name LIKE ? OR address LIKE ?';
    const searchTerm = '%' + keyword + '%';

    db.query(sql, [searchTerm, searchTerm], (err, results) => {
        if (err) {
            return res.status(500).send('Database error');
        }
        res.render('schools', {
            schools: results,
            user: req.session.user,
            searchTerm: keyword  // <-- send back to EJS
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

app.get('/schools/schoolEvents/:id', checkAuthentication, (req, res) => {
    const schoolId = req.params.id;

    const schoolQuery = 'SELECT * FROM schools WHERE id = ?';
    db.query(schoolQuery, [schoolId], (err, schoolResults) => {
        if (err) return res.status(500).send('Error retrieving school');
        if (schoolResults.length === 0) return res.status(404).send('School not found');

        const school = schoolResults[0];

        const events = schoolEventsData[schoolId] || [];

        res.render('schools/schoolEvents', {
            school: school,
            events: events,
            messages: req.flash('success'),
            errors: req.flash('error'),
            formData: {},
            user: req.session.user 
        });

    });
});

app.post('/schools/schoolEvents/:id/add', checkAuthentication, (req, res) => {
    const schoolId = req.params.id;
    const { name, date, location, description } = req.body;

    if (!name || !date || !location || !description) {
        req.flash('error', 'All fields are required.');
        req.flash('formData', req.body);
        return res.redirect('/schools/schoolEvents/' + schoolId);
    }

    const newEvent = { name: name, date: date, location: location, description: description };

    if (!schoolEventsData[schoolId]) {
        schoolEventsData[schoolId] = [];
    }

    schoolEventsData[schoolId].push(newEvent);

    req.flash('success', 'Event added successfully!');
    res.redirect('/schools/schoolEvents/' + schoolId);
});

// Show Edit Event Form (Admin only)
app.get('/schools/schoolEvents/:schoolId/edit/:eventIndex', checkAuthentication, checkAdmin, (req, res) => {
    const schoolId = req.params.schoolId;
    const eventIndex = parseInt(req.params.eventIndex);

    const schoolQuery = 'SELECT * FROM schools WHERE id = ?';
    db.query(schoolQuery, [schoolId], (err, schoolResults) => {
        if (err) return res.status(500).send('Error retrieving school');
        if (schoolResults.length === 0) return res.status(404).send('School not found');

        const school = schoolResults[0];
        const events = schoolEventsData[schoolId] || [];

        if (eventIndex < 0 || eventIndex >= events.length) {
            return res.status(404).send('Event not found');
        }

        const event = events[eventIndex];

        res.render('schools/editschoolEvents', {
            school: school,
            event: event,
            eventIndex: eventIndex,
            errors: req.flash('error'),
            user: req.session.user
        });
    });
});

// Handle Edit Event POST (Admin only)
app.post('/schools/schoolEvents/:schoolId/edit/:eventIndex', checkAuthentication, checkAdmin, (req, res) => {
    const schoolId = req.params.schoolId;
    const eventIndex = parseInt(req.params.eventIndex);
    const { name, date, location, description } = req.body;

    if (!name || !date || !location || !description) {
        req.flash('error', 'All fields are required.');
        return res.redirect(`/schools/schoolEvents/${schoolId}/edit/${eventIndex}`);
    }

    if (!schoolEventsData[schoolId] || eventIndex < 0 || eventIndex >= schoolEventsData[schoolId].length) {
        return res.status(404).send('Event not found');
    }

    schoolEventsData[schoolId][eventIndex] = { name, date, location, description };

    req.flash('success', 'Event updated successfully!');
    res.redirect(`/schools/schoolEvents/${schoolId}`);
});

// Handle Delete Event (Admin only)
app.post('/schools/schoolEvents/:schoolId/delete/:eventIndex', checkAuthentication, checkAdmin, (req, res) => {
    const schoolId = req.params.schoolId;
    const eventIndex = parseInt(req.params.eventIndex);

    if (!schoolEventsData[schoolId] || eventIndex < 0 || eventIndex >= schoolEventsData[schoolId].length) {
        return res.status(404).send('Event not found');
    }

    schoolEventsData[schoolId].splice(eventIndex, 1);

    req.flash('success', 'Event deleted successfully!');
    res.redirect(`/schools/schoolEvents/${schoolId}`);
});

// View All Announcements (User + Admin)
app.get('/announcements', checkAuthentication, (req, res) => {
    const query = 'SELECT * FROM announcements ORDER BY date_posted DESC';
    db.query(query, (err, results) => {
        if (err) throw err;
        res.render('announcements/index', {
            announcements: results,
            user: req.session.user,
            messages: req.flash('success')
        });
    });
});

// Search Announcements (by title or author)
app.get('/announcements/search', checkAuthentication, (req, res) => {
    const keyword = req.query.keyword;
    const sql = 'SELECT * FROM announcements WHERE title LIKE ? OR author LIKE ? ORDER BY date_posted DESC';
    const searchTerm = '%' + keyword + '%';

    db.query(sql, [searchTerm, searchTerm], (err, results) => {
        if (err) throw err;
        res.render('announcements/index', {
            announcements: results,
            user: req.session.user,
            messages: req.flash('success')
        });
    });
});

// Show Add Form (Admin only)
app.get('/announcements/new_announcement', checkAuthentication, checkAdmin, (req, res) => {
    res.render('announcements/new_announcement', {
        user: req.session.user,
        errors: req.flash('error')
    });
});

// Handle Add Form (Admin only)
app.post('/announcements', checkAuthentication, checkAdmin, (req, res) => {
    const { title, content, author } = req.body;

    if (!title || !content || !author) {
        req.flash('error', 'All fields are required.');
        return res.redirect('/announcements/add');
    }

    const date_posted = new Date().toISOString().slice(0, 10);
    const sql = 'INSERT INTO announcements (title, content, author, date_posted) VALUES (?, ?, ?, ?)';
    db.query(sql, [title, content, author, date_posted], (err) => {
        if (err) throw err;
        req.flash('success', 'Announcement added successfully!');
        res.redirect('/announcements');
    });
});

// Show Edit Form (Admin only)
app.get('/announcements/edit/:id', checkAuthentication, checkAdmin, (req, res) => {
    const id = req.params.id;
    const sql = 'SELECT * FROM announcements WHERE id = ?';
    db.query(sql, [id], (err, results) => {
        if (err) throw err;
        if (results.length === 0) return res.status(404).send('Announcement not found');
        res.render('announcements/editAnnouncement', {
            announcement: results[0],
            user: req.session.user,
            errors: req.flash('error')
        });
    });
});

// Handle Update (Admin only)
app.post('/announcements/update/:id', checkAuthentication, checkAdmin, (req, res) => {
    const { title, content, author } = req.body;
    const id = req.params.id;

    if (!title || !content || !author) {
        req.flash('error', 'All fields are required.');
        return res.redirect('/announcements/edit/' + id);
    }

    const sql = 'UPDATE announcements SET title = ?, content = ?, author = ? WHERE id = ?';
    db.query(sql, [title, content, author, id], (err) => {
        if (err) throw err;
        req.flash('success', 'Announcement updated successfully!');
        res.redirect('/announcements');
    });
});

// Handle Delete (Admin only)
app.post('/announcements/delete/:id', checkAuthentication, checkAdmin, (req, res) => {
    const id = req.params.id;
    const sql = 'DELETE FROM announcements WHERE id = ?';
    db.query(sql, [id], (err) => {
        if (err) throw err;
        req.flash('success', 'Announcement deleted.');
        res.redirect('/announcements');
    });
});

// --- basil ---

// view and searchs IGs
app.get('/interestgroups', checkAuthentication, (req, res) => {
    const sql = 'SELECT * FROM interest_groups';
    db.query(sql, (err, results) => {
        if (err) throw err;
        res.render('interestgroups/index', { interest_groups: results, user: req.session.user });
    });
});

// add new IG - Admin
app.get('/interestgroups/add', checkAuthentication, checkAdmin, (req, res) => {
    res.render('interestgroups/add'); // Make sure your file is views/ig/addIg.ejs
});

app.post('/interestgroups', checkAuthentication, checkAdmin, (req, res) => {
    const { name, category, description } = req.body;
    const sql = 'INSERT INTO interest_groups (name, category, description) VALUES (?, ?, ?)';
    db.query(sql, [name, category, description], (err) => {
        if (err) throw err;
        res.redirect('/interestgroups');
    });
});


// edit IG details - Admin
app.get('/interestgroups/:id/edit', checkAuthentication, checkAdmin, (req, res) => {
    const id = req.params.id;
    db.query('SELECT * FROM interest_groups WHERE id = ?', [id], (err, results) => {
        if (err) {
            res.status(500).send('Database error');
        } else {
            const ig = results[0];
            res.render('interestgroups/edit', { ig });
        }
    });
});

app.post('/interestgroups/:id', checkAuthentication, checkAdmin, (req, res) => {
    const id = req.params.id;
    const { name, category, description } = req.body;
    const sql = 'UPDATE interest_groups SET name = ?, category = ?, description = ? WHERE id = ?';
    db.query(sql, [name, category, description, id], (err) => {
        if (err) throw err;
        res.redirect('/interestgroups');
    });
});


// delete IG - Admin
app.post('/interestgroups/:id/delete', checkAuthentication, checkAdmin, (req, res) => {
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
    db.query('SELECT * FROM events ORDER BY date ASC', (error, results) => {
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

app.get('/events/edit/:id', (req, res) => {
    db.query('SELECT * FROM events WHERE id = ?', [req.params.id], (error, results) => {
        if (error) return res.status(500).send('Error retrieving event');

        if (results.length === 0) {
            return res.status(404).send('Event not found');
        }

        const event = results[0];

        // ✅ Format the date to "YYYY-MM-DD" for the <input type="date"> to work
        const formattedDate = new Date(event.date).toISOString().split('T')[0];

        // ✅ Add new key to event object
        event.formattedDate = formattedDate;

        res.render('events/edit', { event: event, user: req.session.user });
    });
});


app.post('/events/update/:id', (req, res) => {
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

// day 2 updated codes
app.get('/events/eventname/:id', (req, res) => {
    const eventId = req.params.id;

    db.query('SELECT * FROM events WHERE id = ?', [eventId], (error, results) => {
        if (error) {
            return res.status(500).send('Database error');
        }

        if (results.length === 0) {
            return res.status(404).send('Event not found');
        }

        const event = results[0];
        res.render('events/eventname', { event: event }); // this matches your eventname.ejs
    });
});


app.get('/search-events', (req, res) => {
    const search = req.query.query;
    const keyword = "%" + search + "%";

    const sql = "SELECT * FROM events WHERE name LIKE ? OR location LIKE ?";
    db.query(sql, [keyword, keyword], (err, results) => {
        if (err) {
            return res.send("Database error: " + err.message);
        }

        res.render("events", {
            events: results,
            user: req.session.user, // adjust if you use something else
            searchTerm: search
        });
    });
});

app.get('/aboutus', (req, res) => {
    res.render('aboutus', { user: req.session.user, messages: req.flash('success') });
});



app.get('/contactus', (req, res) => {
    res.render('contactus', { user: req.session.user, messages: req.flash('success') });
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
        res.render('students/index', { students: results, user: req.session.user, search: search });
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
