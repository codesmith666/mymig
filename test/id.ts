export class UserID {
  private id: string;
  constructor(userID: string) {
    this.id = userID;
  }
  toString() {
    return this.id;
  }
}
