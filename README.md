<h1 align="center" style="font-size: 50px; font-weight: bold;" >EtherCraft</h1>
<br />
<br />

<h2 align="center">A Full Stack Project</h2>

<p align="center">Ethercraft is a complete fantasy game about duels with an opponent in a board with cards (and a tavern background scenery), in a RPG style, that was heavily inspired by the original game <a style="font-weight: bold" href="https://hearthstone.blizzard.com/en-us">HEARTHSTONE</a> by Blizzard Entertainment.</p>
<br />

<h2>Main Features</h2>

- The game has an account system and the duels/matches happen between two users logged in

- All user accounts and existing cards of the game are stored in a PostgreSQL database

- The page where the duels happen between players is a 3D scenario powered by GPU through WebGL, although future plans include making the home page also 3D, so it appears much more like a true game rather than a web page

- The frontend and backend are separated in different domains, with the server side responsible for handling with login, 
authentication, and especially the many simultaneous moves or actions of each duel of players happening. While the domain of the client 
side handles mainly the aesthetic part, that is the textures, 3D, sound effects and animations

- For dealing with multiple requests the server relies on websocket connections, making it faster, more performatic and allowing it to remember the identity of the clients connected
<br />
<br />
<br />

<h2>The Tech Stack</h2>

- Next.JS to make the layout, pages and routing easier

- React

- Tailwind CSS

- Typescript

- Three.JS to build the 3D objects, scenario and visual effects

- Socket.io Client

<h3>And the Server Side Stack</h3>

- Node.JS

- PostgreSQL

- Socket.io and Redis for real-time interaction with the server

- Express for common http

- pg to connect with PostgreSQL database

- Cookie Parser

- Json Web Token (JWT)

- CORS (cross origin resource sharing)
<br />
<br />
<br />

<h1 align="center">Wanna Contribute to This Project?</h1>

- The arts and images I make as original as possible, in a separate repository called 'ethercraft-arts', 
with the Canvas API of the web. If you like to control the flow of the drawing with just code and math, I'd recommend 
checking it out.

- The 3D geometries of the game are modeled in Blender, and the setup of the geometries are saved in the `blender_projects` folder, and then exported as `.glb` archives in the `frontend/public/models` folder

- The structure and tables of the database are in the `backend/database_setup.sql`

- Currently the code that runs the game doesn't actually use the data stored in the database to display and forbid/allow 
moves like throwing a card on the table or what types of card can be used or attack, regarding the rules of the game, so 
you can create any card and its icon in the server