const username_input = document.querySelector('input[name="username"]')
const password_input = document.querySelector('input[name="password"]')
const action_button = document.querySelector('button[name="action"]')
const info_text = document.getElementById('info-text')
const form = document.querySelector('form')
const cookies = document.cookie
let jwt;
if (cookies.split('account_token=')[1]){
    jwt = cookies.split('account_token=')[1]
    const formData = new FormData();
    formData.append("action", "cookie_login");
    formData.append("cookie", jwt);
    fetch("/api/Authentication", {
        method : "POST",
        body : formData
    })
    .then(async res => {
        const data = await res.json()
        change_error_text(data);
    })
}
console.log(jwt)

function change_error_text(data){
    if (!data.success){
        info_text.style.display = 'block'
        info_text.innerText = data.message
        info_text.style.color = 'red'
    }else{
        info_text.style.display = 'block'
        info_text.innerText = data.message
        info_text.style.color = 'lightgreen'
        setTimeout(() => {
            document.location.href = 'Paint.html'
        }, 1500)
    }
}



action_button.addEventListener('click', e => {
    e.preventDefault()
    const formData = new FormData(form)
    formData.append("action", "login");
        fetch('/api/Authentication', {
        method : "POST",
        body: new URLSearchParams(formData)
    } )
    .then(async res => {
        const data = await res.json()
        console.log(data)
        if (data['cookie']){
            document.cookie = `account_token=${data['cookie']}`
        }
        change_error_text(data)
        
    })
})
