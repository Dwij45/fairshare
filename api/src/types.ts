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
export type Share = {
  id: string
  memberId: string
  amountCents: number
  paidAt: string | null
}

export type Bill = {
  id: string
  homeId: string
  title: string
  totalCents: number
  shares: Share[]
}