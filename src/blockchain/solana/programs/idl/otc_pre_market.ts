export type OtcPreMarketType = {
  "version": "0.1.0",
  "name": "otc_pre_market",
  "constants": [
    {
      "name": "CONFIG_SEED",
      "type": "bytes",
      "value": "[99, 111, 110, 102, 105, 103, 95, 115, 101, 101, 100]"
    },
    {
      "name": "WEI6",
      "type": "u64",
      "value": "1_000_000"
    },
    {
      "name": "MAX_FEE",
      "type": "u64",
      "value": "WEI6 / 10"
    }
  ],
  "instructions": [
    {
      "name": "initializeConfig",
      "accounts": [
        {
          "name": "owner",
          "isMut": true,
          "isSigner": true,
          "docs": [
            "Address to be set as protocol owner."
          ]
        },
        {
          "name": "config",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "feeWallet",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "index",
          "type": "u8"
        },
        {
          "name": "fee",
          "type": "u32"
        }
      ]
    },
    {
      "name": "updateConfig",
      "accounts": [
        {
          "name": "owner",
          "isMut": false,
          "isSigner": true,
          "docs": [
            "Address to be set as protocol owner."
          ]
        },
        {
          "name": "config",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "newFeeWallet",
          "isMut": false,
          "isSigner": false,
          "isOptional": true
        }
      ],
      "args": [
        {
          "name": "fee",
          "type": {
            "option": "u32"
          }
        }
      ]
    },
    {
      "name": "createOffer",
      "accounts": [
        {
          "name": "buyerOrSeller",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "config",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "otcOffer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "preMarketConfig",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "configAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "orderAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "offerAccount",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenConfigAccount",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "exTokenAccount",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "exToken",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "exTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "preMarket",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "value",
          "type": "u64"
        },
        {
          "name": "deadline",
          "type": "i64"
        },
        {
          "name": "isBuyer",
          "type": "bool"
        }
      ]
    },
    {
      "name": "updateOffer",
      "accounts": [
        {
          "name": "offerAuthority",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "config",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "otcOffer",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "newValue",
          "type": {
            "option": "u64"
          }
        },
        {
          "name": "newDeadline",
          "type": {
            "option": "i64"
          }
        }
      ]
    },
    {
      "name": "fillOffer",
      "accounts": [
        {
          "name": "user",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "userExAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "offerAuthorityExAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "feeExAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "config",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "otcOffer",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "preMarketConfig",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "configAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "orderAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "offerAccount",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenConfigAccount",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "exToken",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "exTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "preMarket",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "cancelOffer",
      "accounts": [
        {
          "name": "user",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "config",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "otcOffer",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "preMarketConfig",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "configAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "orderAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "preMarket",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "forceCancelOffer",
      "accounts": [
        {
          "name": "operator",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "offerAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "roleAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "config",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "otcOffer",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "preMarketConfig",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "configAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "orderAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "preMarket",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "withdrawStuckToken",
      "accounts": [
        {
          "name": "admin",
          "isMut": false,
          "isSigner": true,
          "docs": [
            "Address to be set as protocol owner."
          ]
        },
        {
          "name": "config",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "adminExAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "configExAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "exToken",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "exTokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "config",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "version",
            "type": "u8"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "index",
            "type": "u8"
          },
          {
            "name": "feeWallet",
            "type": "publicKey"
          },
          {
            "name": "fee",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "otcOffer",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "version",
            "type": "u8"
          },
          {
            "name": "order",
            "type": "publicKey"
          },
          {
            "name": "value",
            "type": "u64"
          },
          {
            "name": "isBuyer",
            "type": "bool"
          },
          {
            "name": "exToken",
            "type": "publicKey"
          },
          {
            "name": "status",
            "type": {
              "defined": "OtcOfferStatus"
            }
          },
          {
            "name": "authority",
            "type": "publicKey"
          },
          {
            "name": "deadline",
            "type": "i64"
          },
          {
            "name": "config",
            "type": "publicKey"
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "OtcOfferStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Open"
          },
          {
            "name": "Filled"
          },
          {
            "name": "Cancelled"
          }
        ]
      }
    }
  ],
  "events": [
    {
      "name": "InitializeConfigEvent",
      "fields": [
        {
          "name": "owner",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "config",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "feeWallet",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "fee",
          "type": "u32",
          "index": false
        },
        {
          "name": "version",
          "type": "u8",
          "index": false
        }
      ]
    },
    {
      "name": "UpdateConfigEvent",
      "fields": [
        {
          "name": "owner",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "config",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "feeWallet",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "fee",
          "type": "u32",
          "index": false
        },
        {
          "name": "version",
          "type": "u8",
          "index": false
        }
      ]
    },
    {
      "name": "CreateOfferEvent",
      "fields": [
        {
          "name": "version",
          "type": "u8",
          "index": false
        },
        {
          "name": "config",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "exToken",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "order",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "orderIndex",
          "type": "u64",
          "index": false
        },
        {
          "name": "tokenIndex",
          "type": "u16",
          "index": false
        },
        {
          "name": "otcOffer",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "user",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "value",
          "type": "u64",
          "index": false
        },
        {
          "name": "isBuyer",
          "type": "bool",
          "index": false
        }
      ]
    },
    {
      "name": "UpdateOfferEvent",
      "fields": [
        {
          "name": "version",
          "type": "u8",
          "index": false
        },
        {
          "name": "config",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "otcOffer",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "user",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "value",
          "type": "u64",
          "index": false
        },
        {
          "name": "deadline",
          "type": "i64",
          "index": false
        }
      ]
    },
    {
      "name": "FillOfferEvent",
      "fields": [
        {
          "name": "version",
          "type": "u8",
          "index": false
        },
        {
          "name": "config",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "exToken",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "user",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "order",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "orderIndex",
          "type": "u64",
          "index": false
        },
        {
          "name": "otcOffer",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "value",
          "type": "u64",
          "index": false
        },
        {
          "name": "fee",
          "type": "u64",
          "index": false
        },
        {
          "name": "status",
          "type": {
            "defined": "OtcOfferStatus"
          },
          "index": false
        }
      ]
    },
    {
      "name": "CancelOfferEvent",
      "fields": [
        {
          "name": "version",
          "type": "u8",
          "index": false
        },
        {
          "name": "config",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "user",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "order",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "orderIndex",
          "type": "u64",
          "index": false
        },
        {
          "name": "otcOffer",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "status",
          "type": {
            "defined": "OtcOfferStatus"
          },
          "index": false
        }
      ]
    },
    {
      "name": "ForceCancelOfferEvent",
      "fields": [
        {
          "name": "version",
          "type": "u8",
          "index": false
        },
        {
          "name": "config",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "operator",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "order",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "orderIndex",
          "type": "u64",
          "index": false
        },
        {
          "name": "otcOffer",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "status",
          "type": {
            "defined": "OtcOfferStatus"
          },
          "index": false
        }
      ]
    },
    {
      "name": "WithdrawStuckTokenEvent",
      "fields": [
        {
          "name": "version",
          "type": "u8",
          "index": false
        },
        {
          "name": "config",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "admin",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "mint",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "amount",
          "type": "u64",
          "index": false
        }
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "Unauthorized",
      "msg": "Unauthorized"
    },
    {
      "code": 6001,
      "name": "InvalidOwner",
      "msg": "Invalid Owner"
    },
    {
      "code": 6002,
      "name": "MintIsNotOwnedByTokenProgram",
      "msg": "Mint Is Not Owned By Token Program"
    },
    {
      "code": 6003,
      "name": "InvalidFee",
      "msg": "Invalid Fee"
    },
    {
      "code": 6004,
      "name": "InvalidFeeWallet",
      "msg": "Invalid Fee Wallet"
    },
    {
      "code": 6005,
      "name": "OrderStatusInvalid",
      "msg": "Order Status Invalid"
    },
    {
      "code": 6006,
      "name": "OfferStatusInvalid",
      "msg": "Offer Status Invalid"
    },
    {
      "code": 6007,
      "name": "TokenStatusInvalid",
      "msg": "Token Status Invalid"
    },
    {
      "code": 6008,
      "name": "TokenConfigMismatch",
      "msg": "Token Config Mismatch"
    },
    {
      "code": 6009,
      "name": "OfferMismatch",
      "msg": "Offer Mismatch"
    },
    {
      "code": 6010,
      "name": "EXTokenNotAccepted",
      "msg": "EX Token Not Accepted"
    },
    {
      "code": 6011,
      "name": "TokenMismatch",
      "msg": "Token Mismatch"
    },
    {
      "code": 6012,
      "name": "ConfigMismatch",
      "msg": "Config Mismatch"
    },
    {
      "code": 6013,
      "name": "InvalidDeadLine",
      "msg": "Invalid Dead Line"
    },
    {
      "code": 6014,
      "name": "InvalidValue",
      "msg": "Invalid Value"
    },
    {
      "code": 6015,
      "name": "InsufficientFunds",
      "msg": "Insufficient Funds"
    },
    {
      "code": 6016,
      "name": "OrderMisMatch",
      "msg": "Order MisMatch"
    },
    {
      "code": 6017,
      "name": "OrderAuthorityInvalid",
      "msg": "Order Authority Invalid"
    }
  ]
};

export const IDL: OtcPreMarketType = {
  "version": "0.1.0",
  "name": "otc_pre_market",
  "constants": [
    {
      "name": "CONFIG_SEED",
      "type": "bytes",
      "value": "[99, 111, 110, 102, 105, 103, 95, 115, 101, 101, 100]"
    },
    {
      "name": "WEI6",
      "type": "u64",
      "value": "1_000_000"
    },
    {
      "name": "MAX_FEE",
      "type": "u64",
      "value": "WEI6 / 10"
    }
  ],
  "instructions": [
    {
      "name": "initializeConfig",
      "accounts": [
        {
          "name": "owner",
          "isMut": true,
          "isSigner": true,
          "docs": [
            "Address to be set as protocol owner."
          ]
        },
        {
          "name": "config",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "feeWallet",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "index",
          "type": "u8"
        },
        {
          "name": "fee",
          "type": "u32"
        }
      ]
    },
    {
      "name": "updateConfig",
      "accounts": [
        {
          "name": "owner",
          "isMut": false,
          "isSigner": true,
          "docs": [
            "Address to be set as protocol owner."
          ]
        },
        {
          "name": "config",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "newFeeWallet",
          "isMut": false,
          "isSigner": false,
          "isOptional": true
        }
      ],
      "args": [
        {
          "name": "fee",
          "type": {
            "option": "u32"
          }
        }
      ]
    },
    {
      "name": "createOffer",
      "accounts": [
        {
          "name": "buyerOrSeller",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "config",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "otcOffer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "preMarketConfig",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "configAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "orderAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "offerAccount",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenConfigAccount",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "exTokenAccount",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "exToken",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "exTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "preMarket",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "value",
          "type": "u64"
        },
        {
          "name": "deadline",
          "type": "i64"
        },
        {
          "name": "isBuyer",
          "type": "bool"
        }
      ]
    },
    {
      "name": "updateOffer",
      "accounts": [
        {
          "name": "offerAuthority",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "config",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "otcOffer",
          "isMut": true,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "newValue",
          "type": {
            "option": "u64"
          }
        },
        {
          "name": "newDeadline",
          "type": {
            "option": "i64"
          }
        }
      ]
    },
    {
      "name": "fillOffer",
      "accounts": [
        {
          "name": "user",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "userExAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "offerAuthorityExAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "feeExAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "config",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "otcOffer",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "preMarketConfig",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "configAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "orderAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "offerAccount",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenConfigAccount",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "exToken",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "exTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "preMarket",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "cancelOffer",
      "accounts": [
        {
          "name": "user",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "config",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "otcOffer",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "preMarketConfig",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "configAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "orderAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "preMarket",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "forceCancelOffer",
      "accounts": [
        {
          "name": "operator",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "offerAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "roleAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "config",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "otcOffer",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "preMarketConfig",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "configAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "orderAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "preMarket",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "withdrawStuckToken",
      "accounts": [
        {
          "name": "admin",
          "isMut": false,
          "isSigner": true,
          "docs": [
            "Address to be set as protocol owner."
          ]
        },
        {
          "name": "config",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "adminExAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "configExAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "exToken",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "exTokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "config",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "version",
            "type": "u8"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "index",
            "type": "u8"
          },
          {
            "name": "feeWallet",
            "type": "publicKey"
          },
          {
            "name": "fee",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "otcOffer",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "version",
            "type": "u8"
          },
          {
            "name": "order",
            "type": "publicKey"
          },
          {
            "name": "value",
            "type": "u64"
          },
          {
            "name": "isBuyer",
            "type": "bool"
          },
          {
            "name": "exToken",
            "type": "publicKey"
          },
          {
            "name": "status",
            "type": {
              "defined": "OtcOfferStatus"
            }
          },
          {
            "name": "authority",
            "type": "publicKey"
          },
          {
            "name": "deadline",
            "type": "i64"
          },
          {
            "name": "config",
            "type": "publicKey"
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "OtcOfferStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Open"
          },
          {
            "name": "Filled"
          },
          {
            "name": "Cancelled"
          }
        ]
      }
    }
  ],
  "events": [
    {
      "name": "InitializeConfigEvent",
      "fields": [
        {
          "name": "owner",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "config",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "feeWallet",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "fee",
          "type": "u32",
          "index": false
        },
        {
          "name": "version",
          "type": "u8",
          "index": false
        }
      ]
    },
    {
      "name": "UpdateConfigEvent",
      "fields": [
        {
          "name": "owner",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "config",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "feeWallet",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "fee",
          "type": "u32",
          "index": false
        },
        {
          "name": "version",
          "type": "u8",
          "index": false
        }
      ]
    },
    {
      "name": "CreateOfferEvent",
      "fields": [
        {
          "name": "version",
          "type": "u8",
          "index": false
        },
        {
          "name": "config",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "exToken",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "order",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "orderIndex",
          "type": "u64",
          "index": false
        },
        {
          "name": "tokenIndex",
          "type": "u16",
          "index": false
        },
        {
          "name": "otcOffer",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "user",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "value",
          "type": "u64",
          "index": false
        },
        {
          "name": "isBuyer",
          "type": "bool",
          "index": false
        }
      ]
    },
    {
      "name": "UpdateOfferEvent",
      "fields": [
        {
          "name": "version",
          "type": "u8",
          "index": false
        },
        {
          "name": "config",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "otcOffer",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "user",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "value",
          "type": "u64",
          "index": false
        },
        {
          "name": "deadline",
          "type": "i64",
          "index": false
        }
      ]
    },
    {
      "name": "FillOfferEvent",
      "fields": [
        {
          "name": "version",
          "type": "u8",
          "index": false
        },
        {
          "name": "config",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "exToken",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "user",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "order",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "orderIndex",
          "type": "u64",
          "index": false
        },
        {
          "name": "otcOffer",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "value",
          "type": "u64",
          "index": false
        },
        {
          "name": "fee",
          "type": "u64",
          "index": false
        },
        {
          "name": "status",
          "type": {
            "defined": "OtcOfferStatus"
          },
          "index": false
        }
      ]
    },
    {
      "name": "CancelOfferEvent",
      "fields": [
        {
          "name": "version",
          "type": "u8",
          "index": false
        },
        {
          "name": "config",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "user",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "order",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "orderIndex",
          "type": "u64",
          "index": false
        },
        {
          "name": "otcOffer",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "status",
          "type": {
            "defined": "OtcOfferStatus"
          },
          "index": false
        }
      ]
    },
    {
      "name": "ForceCancelOfferEvent",
      "fields": [
        {
          "name": "version",
          "type": "u8",
          "index": false
        },
        {
          "name": "config",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "operator",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "order",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "orderIndex",
          "type": "u64",
          "index": false
        },
        {
          "name": "otcOffer",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "status",
          "type": {
            "defined": "OtcOfferStatus"
          },
          "index": false
        }
      ]
    },
    {
      "name": "WithdrawStuckTokenEvent",
      "fields": [
        {
          "name": "version",
          "type": "u8",
          "index": false
        },
        {
          "name": "config",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "admin",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "mint",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "amount",
          "type": "u64",
          "index": false
        }
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "Unauthorized",
      "msg": "Unauthorized"
    },
    {
      "code": 6001,
      "name": "InvalidOwner",
      "msg": "Invalid Owner"
    },
    {
      "code": 6002,
      "name": "MintIsNotOwnedByTokenProgram",
      "msg": "Mint Is Not Owned By Token Program"
    },
    {
      "code": 6003,
      "name": "InvalidFee",
      "msg": "Invalid Fee"
    },
    {
      "code": 6004,
      "name": "InvalidFeeWallet",
      "msg": "Invalid Fee Wallet"
    },
    {
      "code": 6005,
      "name": "OrderStatusInvalid",
      "msg": "Order Status Invalid"
    },
    {
      "code": 6006,
      "name": "OfferStatusInvalid",
      "msg": "Offer Status Invalid"
    },
    {
      "code": 6007,
      "name": "TokenStatusInvalid",
      "msg": "Token Status Invalid"
    },
    {
      "code": 6008,
      "name": "TokenConfigMismatch",
      "msg": "Token Config Mismatch"
    },
    {
      "code": 6009,
      "name": "OfferMismatch",
      "msg": "Offer Mismatch"
    },
    {
      "code": 6010,
      "name": "EXTokenNotAccepted",
      "msg": "EX Token Not Accepted"
    },
    {
      "code": 6011,
      "name": "TokenMismatch",
      "msg": "Token Mismatch"
    },
    {
      "code": 6012,
      "name": "ConfigMismatch",
      "msg": "Config Mismatch"
    },
    {
      "code": 6013,
      "name": "InvalidDeadLine",
      "msg": "Invalid Dead Line"
    },
    {
      "code": 6014,
      "name": "InvalidValue",
      "msg": "Invalid Value"
    },
    {
      "code": 6015,
      "name": "InsufficientFunds",
      "msg": "Insufficient Funds"
    },
    {
      "code": 6016,
      "name": "OrderMisMatch",
      "msg": "Order MisMatch"
    },
    {
      "code": 6017,
      "name": "OrderAuthorityInvalid",
      "msg": "Order Authority Invalid"
    }
  ]
};
