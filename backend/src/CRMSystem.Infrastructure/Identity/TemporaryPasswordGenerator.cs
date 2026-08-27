using System.Security.Cryptography;
using CRMSystem.Application;

namespace CRMSystem.Infrastructure.Identity;

public sealed class TemporaryPasswordGenerator : ITemporaryPasswordGenerator
{
    private const string Uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    private const string Lowercase = "abcdefghijkmnopqrstuvwxyz";
    private const string Digits = "23456789";
    private const string Symbols = "!@$%&*?";
    private const int PasswordLength = 14;

    public string Generate()
    {
        var password = new char[PasswordLength];
        password[0] = Pick(Uppercase);
        password[1] = Pick(Lowercase);
        password[2] = Pick(Digits);
        password[3] = Pick(Symbols);
        var allCharacters = Uppercase + Lowercase + Digits + Symbols;
        for (var index = 4; index < password.Length; index++)
            password[index] = Pick(allCharacters);

        for (var index = password.Length - 1; index > 0; index--)
        {
            var swapIndex = RandomNumberGenerator.GetInt32(index + 1);
            (password[index], password[swapIndex]) = (password[swapIndex], password[index]);
        }
        return new string(password);
    }

    private static char Pick(string characters) =>
        characters[RandomNumberGenerator.GetInt32(characters.Length)];
}
