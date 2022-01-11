const util = {
    setCookie: function(c_name, value) {
        return localStorage.setItem(c_name, value);
    },
    getCookie: function(c_name) {
        return localStorage.getItem(c_name);
    }
}