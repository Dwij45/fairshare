export type Home = {
  id: string
  name: string
}

export type CreateHomeBody = {
  name: string
}
export type Member ={
    id : string
    name:string
    homeId :string
}
export type CreateMemberBody  ={
name :string
}

export type HomeWithMembers = Home & {
  members: Member[]
}