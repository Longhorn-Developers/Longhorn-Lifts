import password from "@inquirer/password";

import { hashPassword } from "./auth";

const main = async () => {
  let pass, confirm;

  do {
    pass = await password({
      message: "Enter password to be hashed: ",
      mask: "*",
    });
    confirm = await password({
      message: "Confirm password to be hashed: ",
      mask: "*",
    });
  } while (pass !== confirm);

  console.log(await hashPassword(pass));
};

main();
