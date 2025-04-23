
const info_text = document.getElementById('info-text')
const form = document.querySelector('form')
const action_button = document.querySelector(`button[name="action"]`)

action_button.addEventListener('click', e => {
    e.preventDefault()
    const formData = new FormData(form)
    formData.append("action", "register");
    fetch('/api/Authentication', {
        method : "POST",
        body: new URLSearchParams(formData)
    } )
    .then(async res => {
        const data = await res.json()
        
        if (!data.success){
            info_text.style.display = 'block'
            info_text.innerText = data.message
            info_text.style.color = 'red'

        }else{
            if (data['cookie']){
                document.cookie = `account_token=${data['cookie']}`
            }
            info_text.style.display = 'block'
            info_text.innerText = data.message
            info_text.style.color = 'lightgreen'
        }
    })
})
