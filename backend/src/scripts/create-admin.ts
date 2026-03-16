import { randomBytes } from "node:crypto"

import { UserRole } from "@prisma/client"

import { prisma } from "../lib/prisma"
import { supabaseAdmin } from "../lib/supabase"

function readArg(name: string) {
  const flag = `--${name}`
  const args = process.argv.slice(2)
  const withEquals = args.find((arg) => arg.startsWith(`${flag}=`))

  if (withEquals) {
    return withEquals.slice(flag.length + 1)
  }

  const index = args.indexOf(flag)
  if (index === -1) {
    return undefined
  }

  return args[index + 1]
}

function buildPassword() {
  return `Admin!${randomBytes(8).toString("base64url")}`
}

async function findAuthUserByEmail(email: string) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client is not configured.")
  }

  let page = 1

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 200,
    })

    if (error) {
      throw error
    }

    const matchedUser = data.users.find((user) => user.email?.toLowerCase() === email)

    if (matchedUser) {
      return matchedUser
    }

    if (data.users.length < 200) {
      return null
    }

    page += 1
  }
}

async function main() {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client is not configured.")
  }

  if (!prisma) {
    throw new Error("Database is not configured.")
  }

  const email = (readArg("email") ?? "admin@yeahbuddy.app").trim().toLowerCase()
  const name = (readArg("name") ?? "YeahBuddy Admin").trim()
  const username = (readArg("username") ?? email.split("@")[0] ?? "admin").trim().toLowerCase()
  const phone = readArg("phone")?.trim() || null
  const explicitPassword = readArg("password")
  const password = explicitPassword?.trim() || buildPassword()
  let authUser = await findAuthUserByEmail(email)
  let created = false
  let passwordSet = false

  if (!authUser) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      password,
      user_metadata: {
        full_name: name,
        name,
        phone: phone ?? undefined,
        role: UserRole.admin,
        username,
      },
    })

    if (error || !data.user) {
      throw error ?? new Error("Failed to create Supabase auth user.")
    }

    authUser = data.user
    created = true
    passwordSet = true
  } else {
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
      email,
      ...(explicitPassword?.trim() ? { password: explicitPassword.trim() } : {}),
      user_metadata: {
        ...(authUser.user_metadata ?? {}),
        full_name: name,
        name,
        phone: phone ?? undefined,
        role: UserRole.admin,
        username,
      },
    })

    if (error || !data.user) {
      throw error ?? new Error("Failed to update Supabase auth user.")
    }

    authUser = data.user
    passwordSet = Boolean(explicitPassword?.trim())
  }

  const profile = await prisma.user.upsert({
    create: {
      email,
      name,
      phone,
      role: UserRole.admin,
      supabaseAuthUserId: authUser.id,
      username,
    },
    update: {
      email,
      name,
      phone,
      role: UserRole.admin,
      supabaseAuthUserId: authUser.id,
      username,
    },
    where: {
      email,
    },
  })

  console.log(
    JSON.stringify(
      {
        created,
        email,
        id: profile.id,
        name,
        password: passwordSet ? password : null,
        phone,
        role: profile.role,
        supabaseAuthUserId: authUser.id,
        username,
      },
      null,
      2,
    ),
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma?.$disconnect()
  })
