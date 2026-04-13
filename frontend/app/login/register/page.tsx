'use client'

import { FormEvent } from "react"

export default function RegisterPage() {
  async function sendData(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const accountIdField = document.getElementById('account-id') as HTMLDivElement
    const passwordField = document.getElementById('password') as HTMLDivElement
    const nicknameField = document.getElementById('user-nickname') as HTMLDivElement

    const data = new FormData(event.currentTarget)

    const request = await fetch('http://localhost:3001/login/validatefields/newaccount', {
      method: 'post',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ account_id: data.get('account_id'), password: data.get('password'), user_nickname: data.get('user_nickname') })
    })

    const response = await request.json()

    const fields = document.querySelectorAll('.fielddiv')
    
    for (const field of fields) {
      field.classList.remove('invalid')
      const span = field.querySelector('span')
      if (span) { span.remove() }
    }

    const texts: string[][] = [
      [
        'Este id de usuário já existe. Escolha outro.',
        'Este id de usuário é muito curto. Deve ser de 5 a 20 caracteres.',
        'Este id de usuário é muito longo. Deve ser de 5 a 20 caracteres.'
      ],
      [
        'Esta senha é muito curta. Deve ser de 10 a 45 caracteres.',
        'Esta senha é muito longa. Deve ser de 10 a 45 caracteres.'
      ],
      [
        'Este nome de jogador já existe. Escolha outro.',
        'Este nome de jogador é muito curto. Deve ser de 5 a 30 caracteres.',
        'Este nome de jogador é muito longo. Deve ser de 5 a 30 caracteres.'
      ]
    ]

    if (response.messages) {
      for (const msg of response.messages) {
        fields[msg.code[0]].innerHTML += `<span id="account-id-span" class="w-67.5 md:w-80 text-[12px]">${texts[msg.code[0]][msg.code[1]]}</span>`
        fields[msg.code[0]].classList.add('invalid')
      }
    }
  }

  return (
    <main className="bg-[url(/images/home-background.png)] bg-cover w-full h-full flex justify-center items-center">
      <form onSubmit={sendData} className="border-(--gold) border-4 rounded-[10px] bg-(--gray) flex flex-col justify-evenly items-center p-3 h-[50vh]">
        <img src="/images/logo.png" width={100} alt="Logo" />
        <div id="account-id" className="flex flex-col fielddiv">
          <input type="text" name="account_id" placeholder="ID ou Email da Conta..." className="bg-white w-67.5 md:w-80 h-7.5" />
        </div>
        <div id="password" className="flex flex-col fielddiv">
          <input type="password" name="password" placeholder="Senha..." className="bg-white w-67.5 md:w-80 h-7.5" />
        </div>
        <div id="user-nickname" className="flex flex-col fielddiv">
          <input type="text" name="user_nickname" placeholder="Nome de Jogador..." className="bg-white w-67.5 md:w-80 h-7.5" />
        </div>
        <button type="submit" className="border-(--gold) border-4 rounded-[7px] bg-(--goldgray) text-white p-2 text-[15px] font-bold transition-all duration-300 hover:bg-(--darkgoldgray) cursor-pointer">ENTRAR</button>
      </form>
    </main>
  )
}