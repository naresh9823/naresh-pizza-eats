function ensureLoggedIn(req, res, next) {
    if (req.session.user) return next();
    return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
  }
  
  function ensureAdmin(req, res, next) {
    if (req.session.user && req.session.user.is_admin) return next();
    return res.redirect('/admin/login');
  }
  
  module.exports = { ensureLoggedIn, ensureAdmin };