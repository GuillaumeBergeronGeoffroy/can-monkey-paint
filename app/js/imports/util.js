const util = {
    setCookie: function(c_name, value) {
        return localStorage.setItem(c_name, value);
    },
    getCookie: function(c_name) {
        return localStorage.getItem(c_name);
    },
    sha256: async (message) => {
        // encode as UTF-8
        const msgBuffer = new TextEncoder().encode(message);                    
    
        // hash the message
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    
        // convert ArrayBuffer to Array
        const hashArray = Array.from(new Uint8Array(hashBuffer));
    
        // convert bytes to hex string                  
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    }
}