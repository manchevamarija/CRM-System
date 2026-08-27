using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace CRMSystem.Application.Realtime;

[Authorize]
public sealed class CrmHub : Hub { }
